import { describe, expect, it } from 'vitest'
import type { Note } from '@/lib/db/schema'
import { searchNotes } from '@/lib/notes/search'

function makeNote(overrides: Partial<Note>): Note {
  return {
    id: 'x',
    title: '',
    body: '',
    folder: '',
    createdAt: 0,
    updatedAt: 0,
    clientSeq: 0,
    ...overrides,
  }
}

describe('searchNotes', () => {
  it('returns all notes when the query is empty', () => {
    const a = makeNote({ id: 'a', title: 'A' })
    const b = makeNote({ id: 'b', title: 'B' })
    expect(searchNotes([a, b], '').map((n) => n.id)).toEqual(['a', 'b'])
    expect(searchNotes([a, b], '   ').map((n) => n.id)).toEqual(['a', 'b'])
  })

  it('matches case-insensitively in title and body', () => {
    const notes = [
      makeNote({ id: 'a', title: 'Origami release plan' }),
      makeNote({ id: 'b', title: 'Misc', body: 'Talk about origami at the meeting' }),
      makeNote({ id: 'c', title: 'Unrelated' }),
    ]
    const result = searchNotes(notes, 'ORIGAMI')
    expect(result.map((n) => n.id)).toEqual(['a', 'b'])
  })

  it('ranks title matches above body matches', () => {
    const t = makeNote({ id: 't', title: 'kioku release', updatedAt: 1 })
    const b = makeNote({ id: 'b', title: 'Misc', body: 'kioku is local', updatedAt: 10 })
    const result = searchNotes([t, b], 'kioku')
    expect(result.map((n) => n.id)).toEqual(['t', 'b'])
  })

  it('breaks score ties by most recent updatedAt', () => {
    const old = makeNote({ id: 'old', title: 'kioku', updatedAt: 1 })
    const fresh = makeNote({ id: 'fresh', title: 'kioku', updatedAt: 100 })
    const result = searchNotes([old, fresh], 'kioku')
    expect(result.map((n) => n.id)).toEqual(['fresh', 'old'])
  })

  it('respects the limit option', () => {
    const notes = Array.from({ length: 10 }, (_, i) => makeNote({ id: String(i), title: 'kioku' }))
    expect(searchNotes(notes, 'kioku', { limit: 3 })).toHaveLength(3)
  })

  it('drops notes that match no token', () => {
    const a = makeNote({ id: 'a', title: 'kioku' })
    const b = makeNote({ id: 'b', title: 'totally unrelated' })
    expect(searchNotes([a, b], 'kioku').map((n) => n.id)).toEqual(['a'])
  })

  it('multi-token query scores each distinct token once', () => {
    const both = makeNote({ id: 'both', title: 'kioku release plan', updatedAt: 1 })
    const one = makeNote({ id: 'one', title: 'kioku alone', updatedAt: 100 })
    // both: title hits "kioku" + "release" = 3 + 3 = 6
    // one:  title hits "kioku" = 3
    const result = searchNotes([both, one], 'kioku release')
    expect(result.map((n) => n.id)).toEqual(['both', 'one'])
  })

  it('matches CJK queries via overlapping bigrams', () => {
    const target = makeNote({ id: 'a', title: 'プロジェクト方針', body: '' })
    const other = makeNote({ id: 'b', title: '無関係', body: '' })
    // The whole query is longer than the title, so a naive substring search
    // misses; bigram tokenization should still hit 'プロ', '方針', etc.
    const result = searchNotes([target, other], 'プロジェクト方針について教えて')
    expect(result.map((n) => n.id)).toEqual(['a'])
  })
})
