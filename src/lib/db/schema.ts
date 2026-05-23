import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { nanoid } from 'nanoid'

const now = (name: string) =>
  integer(name)
    .notNull()
    .$defaultFn(() => Date.now())

export const notes = sqliteTable('notes', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  title: text('title').notNull(),
  body: text('body').notNull().default(''),
  /** Free-form folder path; not enforced. e.g. "/Work/Projects". */
  folder: text('folder').notNull().default(''),
  createdAt: now('created_at'),
  updatedAt: now('updated_at'),
  /** Monotonic per-note write counter supplied by the client. Stored so an
   *  out-of-order save can be rejected server-side — see updateNote(). */
  clientSeq: integer('client_seq').notNull().default(0),
})

export type Note = typeof notes.$inferSelect
export type NewNote = typeof notes.$inferInsert
