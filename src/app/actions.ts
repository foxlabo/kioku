'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { ensureDbReady } from '@/lib/db/init'
import { createNote, deleteNote, updateNote } from '@/lib/db/queries'

/** 2 MB body cap — keeps a runaway paste from filling the DB. */
const MAX_BODY_BYTES = 2 * 1024 * 1024
/** Title cap — kept short for list rendering. */
const MAX_TITLE_LENGTH = 200
/** Folder cap — free-form path label. */
const MAX_FOLDER_LENGTH = 200

const titleSchema = z
  .string()
  .trim()
  .max(MAX_TITLE_LENGTH, { message: `Title must be ${MAX_TITLE_LENGTH} characters or fewer.` })

// Note: `z.string().max()` counts UTF-16 code units, but the cap is documented
// in UTF-8 bytes — non-ASCII characters can take 2-4 bytes each, so we refine.
const bodySchema = z.string().refine((s) => Buffer.byteLength(s, 'utf8') <= MAX_BODY_BYTES, {
  message: `Body must be under ${MAX_BODY_BYTES} bytes.`,
})

const folderSchema = z
  .string()
  .trim()
  .max(MAX_FOLDER_LENGTH, { message: `Folder must be ${MAX_FOLDER_LENGTH} characters or fewer.` })

const updateSchema = z.object({
  id: z.string().min(1).max(64),
  title: titleSchema,
  body: bodySchema,
  folder: folderSchema,
  /** Monotonic per-note seq from the client. The DB rejects writes with a
   *  seq <= the most recently stored one, which makes out-of-order autosaves
   *  safe. Max value is a sanity cap on what a client can claim. */
  clientSeq: z
    .number()
    .int()
    .min(0)
    .max(2 ** 31 - 1),
})

const deleteSchema = z.object({
  id: z.string().min(1).max(64),
})

/** Create a fresh note and redirect to its editor. Form-action only — never
 *  called during render so it can safely call `revalidatePath`. */
export async function createBlankNoteAction(): Promise<never> {
  ensureDbReady()
  const note = createNote({ title: 'Untitled', body: '', folder: '' })
  revalidatePath('/')
  redirect(`/notes/${note.id}`)
}

export interface UpdateNoteResult {
  ok: boolean
  /** True when the write was rejected as stale (a newer save already won).
   *  Clients should treat this as success, not an error. */
  stale?: boolean
  error?: string
}

/** Persist edits to a note. */
export async function updateNoteAction(input: {
  id: string
  title: string
  body: string
  folder: string
  clientSeq: number
}): Promise<UpdateNoteResult> {
  ensureDbReady()
  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }
  const { id, title, body, folder, clientSeq } = parsed.data
  const result = updateNote(id, {
    title: title || 'Untitled',
    body,
    folder,
    clientSeq,
  })
  if (result.kind === 'not-found') {
    return { ok: false, error: 'Note not found.' }
  }
  if (result.kind === 'stale') {
    // A newer write already won — that's fine, nothing to do.
    return { ok: true, stale: true }
  }
  revalidatePath('/')
  revalidatePath(`/notes/${id}`)
  return { ok: true }
}

/** Permanently delete a note. */
export async function deleteNoteAction(input: { id: string }): Promise<void> {
  ensureDbReady()
  const parsed = deleteSchema.safeParse(input)
  if (!parsed.success) {
    return
  }
  deleteNote(parsed.data.id)
  revalidatePath('/')
  redirect('/')
}
