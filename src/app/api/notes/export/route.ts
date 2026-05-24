import JSZip from 'jszip'
import { ensureDbReady } from '@/lib/db/init'
import { iterateNotes, summarizeNotesSize } from '@/lib/db/queries'
import { noteToMarkdown, zipPathFor } from '@/lib/notes/export'

/** Refuse to export more than 10k notes in one ZIP. Local single-user
 *  libraries shouldn't realistically hit this, but the archive build is
 *  fully buffered in memory so it needs a hard cap. */
const MAX_EXPORT_NOTES = 10_000
/** Refuse to export more than this much total markdown (UTF-8 bytes). At
 *  the 2 MiB per-note body cap, the absolute worst case is ~20 GiB; this
 *  cap keeps the actual realistic case bounded so a hostile DB import
 *  can't OOM the server. */
const MAX_EXPORT_BYTES = 256 * 1024 * 1024
/** Per-row cap. A normal note tops out at ~2 MiB; an imported DB might
 *  carry something larger. We refuse before reading the body. */
const MAX_ROW_BYTES = 4 * 1024 * 1024
/** Per-id cap. Real ids are nanoid (21 chars); a hostile / imported DB
 *  could carry a huge id, which would blow up in `safeIdSuffix` because
 *  percent-encoding can expand each byte ~9× for UTF-8. */
const MAX_ID_BYTES = 64

function logError(scope: string, err: unknown): void {
  // biome-ignore lint/suspicious/noConsole: server-side observability for opaque error responses
  console.error(`[kioku/${scope}]`, err)
}

/**
 * Serve all notes as a single ZIP. The archive layout mirrors each note's
 * `folder` field, with the filename suffixed by the note id so two
 * same-titled notes never collide. The total exported size is bounded so
 * a runaway DB can't blow up the server.
 */
export async function GET(): Promise<Response> {
  try {
    ensureDbReady()
    // SQL-side preflight: returns counts and byte totals using SQLite's
    // `length()` so we never materialize a body just to measure it. If
    // ANY single row is too big, we refuse before reading it.
    const stats = summarizeNotesSize()
    if (stats.count > MAX_EXPORT_NOTES) {
      return new Response(`Too many notes to export at once (limit ${MAX_EXPORT_NOTES}).`, {
        status: 413,
      })
    }
    if (stats.maxRowBytes > MAX_ROW_BYTES) {
      return new Response(`A single note exceeds the per-row export limit.`, { status: 413 })
    }
    if (stats.maxIdBytes > MAX_ID_BYTES) {
      return new Response(`A note id exceeds the export limit.`, { status: 413 })
    }
    if (stats.totalBytes > MAX_EXPORT_BYTES) {
      return new Response(`Export size exceeded the ${MAX_EXPORT_BYTES}-byte limit.`, {
        status: 413,
      })
    }
    const zip = new JSZip()
    let totalBytes = 0
    let count = 0
    // Walk row-by-row via better-sqlite3's iterator so we never
    // materialize every body simultaneously. The preflight already
    // guarantees we'll fit within the cap, but we re-check defensively
    // (e.g. a concurrent write could land between preflight and read).
    for (const note of iterateNotes()) {
      const body = noteToMarkdown(note)
      totalBytes += Buffer.byteLength(body, 'utf8')
      if (totalBytes > MAX_EXPORT_BYTES) {
        return new Response(`Export size exceeded the ${MAX_EXPORT_BYTES}-byte limit.`, {
          status: 413,
        })
      }
      zip.file(zipPathFor(note, note.id), body)
      count++
    }
    if (count === 0) {
      // Still emit a valid (empty) ZIP rather than 204 — clients expect
      // an attachment.
    }
    // Buffer the archive in memory — local single-user, notes are small.
    // If this becomes a concern, switch to JSZip.generateNodeStream().
    // 'arraybuffer' (not 'uint8array') because ArrayBuffer is the only
    // JSZip output type that lines up cleanly with the Web `BodyInit` def.
    const buffer = await zip.generateAsync({
      type: 'arraybuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    })
    const date = new Date().toISOString().slice(0, 10)
    const filename = `kioku-${date}.zip`
    return new Response(buffer, {
      headers: {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="${filename}"`,
        'content-length': String(buffer.byteLength),
        'cache-control': 'no-store',
      },
    })
  } catch (err) {
    logError('export-zip', err)
    return new Response('Internal error', { status: 500 })
  }
}
