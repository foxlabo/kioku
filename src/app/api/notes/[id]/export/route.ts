import { z } from 'zod'
import { ensureDbReady } from '@/lib/db/init'
import { getNote, summarizeNoteSize } from '@/lib/db/queries'
import { noteToMarkdown, safeFilenameBase } from '@/lib/notes/export'

const ID_SCHEMA = z.string().min(1).max(64)
/** Per-note byte cap, mirrors the ZIP route's cap. SQL-side preflight
 *  rejects an oversized row before any text is materialized. */
const MAX_ROW_BYTES = 4 * 1024 * 1024

interface RouteContext {
  params: Promise<{ id: string }>
}

function logError(scope: string, err: unknown): void {
  // biome-ignore lint/suspicious/noConsole: server-side observability for opaque error responses
  console.error(`[kioku/${scope}]`, err)
}

/**
 * Serve a single note as `<safe-title>.md`. The browser treats this as a
 * download because of `Content-Disposition: attachment`.
 */
export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const { id } = await ctx.params
    if (!ID_SCHEMA.safeParse(id).success) {
      return new Response('Bad id', { status: 400 })
    }
    ensureDbReady()
    // Measure the row server-side first — `summarizeNoteSize` uses
    // `length(CAST(... AS BLOB))` so we never pull body bytes into JS
    // memory just to reject the export.
    const size = summarizeNoteSize(id)
    if (!size.exists) return new Response('Not found', { status: 404 })
    if (size.bytes > MAX_ROW_BYTES) {
      return new Response('Note exceeds the per-row export limit.', { status: 413 })
    }
    const note = getNote(id)
    if (!note) return new Response('Not found', { status: 404 })
    const body = noteToMarkdown(note)
    const filename = `${safeFilenameBase(note.title || 'Untitled')}.md`
    // RFC 5987 §3.2.1 / §3.2.2 ext-value. `encodeURIComponent` is close but
    // leaves "'", "(", ")", and "*" unescaped — all reserved in this
    // grammar — so we percent-encode them too.
    const encoded = encodeURIComponent(filename).replace(
      /['()*]/g,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
    )
    // ASCII fallback for older clients (and for the un-starred filename).
    const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '_')
    return new Response(body, {
      headers: {
        'content-type': 'text/markdown; charset=utf-8',
        'content-disposition': `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`,
        'cache-control': 'no-store',
      },
    })
  } catch (err) {
    logError('export-single', err)
    return new Response('Internal error', { status: 500 })
  }
}
