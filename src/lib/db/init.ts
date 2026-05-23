import { resolve } from 'node:path'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { sampleNotes } from '@/lib/notes/samples'
import { db } from './index'
import { upsertNoteIfMissing } from './queries'

let initialized = false

/**
 * Apply pending migrations and seed sample notes idempotently. Safe to call
 * many times — `drizzle migrate` and `INSERT OR IGNORE` are both no-ops once
 * the first call has won.
 */
export function ensureDbReady(): void {
  if (initialized) return
  migrate(db, { migrationsFolder: resolve(process.cwd(), 'drizzle') })
  for (const note of sampleNotes) {
    upsertNoteIfMissing(note)
  }
  initialized = true
}
