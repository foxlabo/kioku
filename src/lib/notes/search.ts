import type { Note } from '@/lib/db/schema'

/** Score weights for keyword matches. */
const TITLE_WEIGHT = 3
const BODY_WEIGHT = 1

/** Detects Hiragana, Katakana, CJK Unified Ideographs, and CJK full-width. */
const CJK_REGEX = /[぀-ヿ㐀-鿿＀-￯]/

interface SearchOptions {
  /** Maximum number of notes to return. */
  limit?: number
}

/** Expand a CJK token into overlapping bigrams so substring matching works
 *  for whitespace-less Japanese/Chinese queries. ASCII queries pass through. */
function tokenize(query: string): string[] {
  const base = Array.from(new Set(query.split(/\s+/).filter(Boolean)))
  if (!CJK_REGEX.test(query)) return base
  const out = new Set(base)
  for (const tok of base) {
    if (tok.length <= 2) continue
    for (let i = 0; i < tok.length - 1; i++) {
      out.add(tok.slice(i, i + 2))
    }
  }
  return [...out]
}

/**
 * Pure keyword search + ranking over an in-memory note list. Splits the
 * query into whitespace-separated tokens (case-insensitive); CJK queries
 * also pick up overlapping bigrams so they match across Japanese text that
 * lacks word boundaries. Scores each note by how many distinct tokens it
 * matches in the title (×{@link TITLE_WEIGHT}) and body (×{@link
 * BODY_WEIGHT}), drops zero-score notes, and returns the top-`limit` by
 * score then `updatedAt`.
 *
 * Same function is reused on the home page (full filter) and from the Ask
 * endpoint (top-K retrieval).
 */
export function searchNotes(notes: Note[], query: string, options?: SearchOptions): Note[] {
  const q = query.trim().toLowerCase()
  if (!q) {
    const limit = options?.limit
    return typeof limit === 'number' ? notes.slice(0, limit) : notes
  }

  const tokens = tokenize(q)
  if (tokens.length === 0) {
    const limit = options?.limit
    return typeof limit === 'number' ? notes.slice(0, limit) : notes
  }

  const scored = notes
    .map((note) => {
      const title = note.title.toLowerCase()
      const body = note.body.toLowerCase()
      let score = 0
      for (const token of tokens) {
        if (title.includes(token)) score += TITLE_WEIGHT
        if (body.includes(token)) score += BODY_WEIGHT
      }
      return { note, score }
    })
    .filter((s) => s.score > 0)

  scored.sort((a, b) => b.score - a.score || b.note.updatedAt - a.note.updatedAt)

  const limit = options?.limit
  const sliced = typeof limit === 'number' ? scored.slice(0, limit) : scored
  return sliced.map((s) => s.note)
}
