import { and, desc, eq, lt } from 'drizzle-orm'
import { db, sqliteHandle } from './index'
import { type NewNote, type Note, notes } from './schema'

export function listNotes(): Note[] {
  return db.select().from(notes).orderBy(desc(notes.updatedAt)).all()
}

/** Total row count — cheap, used by the export route to pre-check budgets
 *  before pulling every body into memory. */
export function countNotes(): number {
  const row = sqliteHandle.prepare('SELECT COUNT(*) AS c FROM notes').get() as { c: number }
  return row.c
}

export interface NoteSizeReport {
  /** True iff a note with the supplied id exists. */
  exists: boolean
  /** UTF-8 bytes for `body + title + folder`. Zero when the row is missing. */
  bytes: number
}

/** Measure a single note's text content WITHOUT pulling the body out of
 *  SQLite. Used by the per-note export route to enforce a size cap before
 *  materializing the markdown. */
export function summarizeNoteSize(id: string): NoteSizeReport {
  const row = sqliteHandle
    .prepare(
      `SELECT length(CAST(body AS BLOB)) + length(CAST(title AS BLOB)) + length(CAST(folder AS BLOB)) AS bytes
       FROM notes WHERE id = ?`,
    )
    .get(id) as { bytes: number } | undefined
  if (!row) return { exists: false, bytes: 0 }
  return { exists: true, bytes: row.bytes ?? 0 }
}

export interface NotesSizeReport {
  count: number
  totalBytes: number
  /** Largest `body + title + folder + id` of any single note, in UTF-8 bytes. */
  maxRowBytes: number
  /** Longest id in the table, UTF-8 bytes. App invariant is 21 (nanoid); a
   *  hostile / imported DB could carry an unbounded value, and that id
   *  feeds the ZIP entry filename through `safeIdSuffix`, which can
   *  expand a single byte up to 9 chars during percent-encoding. */
  maxIdBytes: number
}

/** Sum byte-lengths of every note's text content WITHOUT materializing any
 *  body. SQLite's `length()` on a TEXT column returns characters, not
 *  bytes — but our schema only ever stores UTF-8 text and we can use
 *  `length(CAST(... AS BLOB))` to get bytes. Used by the ZIP export to
 *  reject hostile databases before loading anything heavy. */
export function summarizeNotesSize(): NotesSizeReport {
  const row = sqliteHandle
    .prepare(
      `SELECT
         COUNT(*) AS count,
         COALESCE(SUM(length(CAST(body AS BLOB)) + length(CAST(title AS BLOB)) + length(CAST(folder AS BLOB)) + length(CAST(id AS BLOB))), 0) AS totalBytes,
         COALESCE(MAX(length(CAST(body AS BLOB)) + length(CAST(title AS BLOB)) + length(CAST(folder AS BLOB)) + length(CAST(id AS BLOB))), 0) AS maxRowBytes,
         COALESCE(MAX(length(CAST(id AS BLOB))), 0) AS maxIdBytes
       FROM notes`,
    )
    .get() as {
    count: number
    totalBytes: number
    maxRowBytes: number
    maxIdBytes: number
  }
  return row
}

/** Lazily walk every note row in update-time-desc order. better-sqlite3's
 *  iterator yields one row at a time so the caller can build a ZIP entry
 *  per note without ever holding all bodies in memory. */
export function iterateNotes(): IterableIterator<Note> {
  // Column names match Drizzle's snake_case mappings.
  const stmt = sqliteHandle.prepare(
    'SELECT id, title, body, folder, created_at AS createdAt, updated_at AS updatedAt, client_seq AS clientSeq FROM notes ORDER BY updated_at DESC',
  )
  return stmt.iterate() as IterableIterator<Note>
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
