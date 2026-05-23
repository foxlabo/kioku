import { resolve } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

const dbPath = process.env.DATABASE_URL?.replace(/^file:/, '') ?? './kioku.db'
const absolutePath = resolve(process.cwd(), dbPath)

const sqlite = new Database(absolutePath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })
export type DB = typeof db
export { schema }
