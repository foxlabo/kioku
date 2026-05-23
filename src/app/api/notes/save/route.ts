import { z } from 'zod'
import { ensureDbReady } from '@/lib/db/init'
import { updateNote } from '@/lib/db/queries'

/** Hard cap on the whole request body — backstop on top of field caps. */
const MAX_BODY_BYTES = 2 * 1024 * 1024
const MAX_TITLE_LENGTH = 200
const MAX_FOLDER_LENGTH = 200

const requestSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().trim().max(MAX_TITLE_LENGTH),
  body: z.string().refine((s) => Buffer.byteLength(s, 'utf8') <= MAX_BODY_BYTES, {
    message: 'Body too large.',
  }),
  folder: z.string().trim().max(MAX_FOLDER_LENGTH),
  clientSeq: z
    .number()
    .int()
    .min(0)
    .max(2 ** 31 - 1),
})

function logError(scope: string, err: unknown): void {
  // biome-ignore lint/suspicious/noConsole: server-side observability for opaque error responses
  console.error(`[kioku/${scope}]`, err)
}

/**
 * POST endpoint mirroring updateNoteAction, intended for `fetch` calls with
 * `keepalive: true` (and `navigator.sendBeacon`) — server actions don't
 * reliably complete from a `beforeunload` handler.
 *
 * Server-side ordering via `client_seq` makes this safe to call concurrently
 * with the normal action path: stale writes are dropped in the DB layer.
 */
export async function POST(req: Request) {
  let raw: string
  try {
    raw = await req.text()
  } catch {
    return Response.json({ error: 'Could not read request body' }, { status: 400 })
  }
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    return Response.json({ error: 'Request body too large' }, { status: 413 })
  }

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request shape' }, { status: 400 })
  }

  try {
    ensureDbReady()
    const { id, title, body: noteBody, folder, clientSeq } = parsed.data
    const result = updateNote(id, {
      title: title || 'Untitled',
      body: noteBody,
      folder,
      clientSeq,
    })
    if (result.kind === 'not-found') {
      return Response.json({ ok: false, error: 'Note not found.' }, { status: 404 })
    }
    if (result.kind === 'stale') {
      return Response.json({ ok: true, stale: true })
    }
    return Response.json({ ok: true })
  } catch (err) {
    logError('save', err)
    return Response.json({ ok: false, error: 'Save failed.' }, { status: 500 })
  }
}
