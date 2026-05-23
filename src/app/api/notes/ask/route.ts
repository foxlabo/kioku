import { createOpenAI } from '@ai-sdk/openai'
import { convertToModelMessages, streamText, type UIMessage } from 'ai'
import { z } from 'zod'
import { DEFAULT_MODEL, isAllowedModel } from '@/lib/ai/models'
import { ensureDbReady } from '@/lib/db/init'
import { listNotes } from '@/lib/db/queries'
import { buildAskSystemPrompt, extractLatestUserText } from '@/lib/notes/prompt'
import { searchNotes } from '@/lib/notes/search'

/** Hard cap on the whole request body in UTF-8 bytes — backstop on top of
 *  field caps. Measured with `Buffer.byteLength` below. */
const MAX_BODY_BYTES = 2 * 1024 * 1024
/** Max characters (UTF-16 code units) per text part. Multiply by ~3 for an
 *  upper bound in bytes; the request-body byte cap above is the real ceiling. */
const MAX_PART_CHARS = 8_000
/** Max chat turns we forward to the model. */
const MAX_MESSAGES = 60
/** Top-K notes retrieved per question. */
const TOP_K = 6

const textPartSchema = z.object({
  type: z.literal('text'),
  text: z.string().max(MAX_PART_CHARS),
})

/** We only accept text parts — files/images would change the security surface. */
const partSchema = textPartSchema

/** Client never sends `system`; the server attaches the grounded system prompt
 *  itself, so accepting one over the wire would let a direct POST inject
 *  higher-priority instructions. */
const messageSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  role: z.enum(['user', 'assistant']),
  parts: z.array(partSchema).max(32),
})

const requestSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  messages: z.array(messageSchema).max(MAX_MESSAGES),
  model: z.string().max(64).optional(),
})

function logError(scope: string, err: unknown): void {
  // biome-ignore lint/suspicious/noConsole: server-side observability for opaque error responses
  console.error(`[kioku/${scope}]`, err)
}

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

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'OPENAI_API_KEY is not set on the server.' }, { status: 500 })
  }

  const requestedModel = parsed.data.model ?? DEFAULT_MODEL
  if (!isAllowedModel(requestedModel)) {
    return Response.json({ error: 'Model not allowed.' }, { status: 400 })
  }

  // The schema validates shape; we hand the SDK a typed copy rather than a
  // bare cast. Roles are already restricted to 'user' | 'assistant'.
  const uiMessages: UIMessage[] = parsed.data.messages.map((m) => ({
    id: m.id ?? crypto.randomUUID(),
    role: m.role,
    parts: m.parts,
  }))
  const latestQuestion = extractLatestUserText(parsed.data.messages)

  ensureDbReady()
  const allNotes = listNotes()
  let retrieved = latestQuestion
    ? searchNotes(allNotes, latestQuestion, { limit: TOP_K })
    : allNotes.slice(0, TOP_K)
  // Fallback so the model still sees something to work with when the query
  // didn't substring-match anything (common for very short notes / typos).
  if (retrieved.length === 0) retrieved = allNotes.slice(0, TOP_K)

  const systemPrompt = buildAskSystemPrompt(retrieved)

  try {
    const openai = createOpenAI({ apiKey })
    const modelMessages = await convertToModelMessages(uiMessages)
    const result = streamText({
      model: openai(requestedModel),
      system: systemPrompt,
      messages: modelMessages,
      onError: ({ error }) => logError('ask/stream', error),
    })
    return result.toUIMessageStreamResponse()
  } catch (err) {
    logError('ask', err)
    return Response.json(
      { error: 'The Ask endpoint failed. Check the server logs.' },
      { status: 500 },
    )
  }
}
