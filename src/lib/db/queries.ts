import { and, desc, eq, lt } from 'drizzle-orm'
import { db } from './index'
import { type NewNote, type Note, notes } from './schema'

export function listNotes(): Note[] {
  return db.select().from(notes).orderBy(desc(notes.updatedAt)).all()
}

export function getNote(id: string): Note | undefined {
  return db.select().from(notes).where(eq(notes.id, id)).get()
}

export function createNote(values: Omit<NewNote, 'createdAt' | 'updatedAt'>): Note {
  return db.insert(notes).values(values).returning().get()
}

/** Idempotent insert for the sample-note seeder. */
export function upsertNoteIfMissing(values: Omit<NewNote, 'createdAt' | 'updatedAt'>): void {
  db.insert(notes).values(values).onConflictDoNothing().run()
}

export interface UpdateNoteValues {
  title: string
  body: string
  folder: string
  /** Monotonic client-side seq. The DB drops writes whose seq is not STRICTLY
   *  greater than the stored one, which makes out-of-order autosaves safe and
   *  also disambiguates two tabs that happen to mint the same seq. */
  clientSeq: number
}

export type UpdateNoteResult =
  | { kind: 'ok'; note: Note }
  | { kind: 'stale' }
  | { kind: 'not-found' }

export function updateNote(id: string, values: UpdateNoteValues): UpdateNoteResult {
  const existing = db.select().from(notes).where(eq(notes.id, id)).get()
  if (!existing) return { kind: 'not-found' }
  const note = db
    .update(notes)
    .set({
      title: values.title,
      body: values.body,
      folder: values.folder,
      clientSeq: values.clientSeq,
      updatedAt: Date.now(),
    })
    .where(and(eq(notes.id, id), lt(notes.clientSeq, values.clientSeq)))
    .returning()
    .get()
  if (!note) return { kind: 'stale' }
  return { kind: 'ok', note }
}

export function deleteNote(id: string): void {
  db.delete(notes).where(eq(notes.id, id)).run()
}
