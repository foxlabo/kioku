import { describe, expect, it } from 'vitest'
import type { Note } from '@/lib/db/schema'
import { noteToMarkdown, safeFilenameBase, safeIdSuffix, zipPathFor } from '@/lib/notes/export'

function note(overrides: Partial<Note>): Note {
  return {
    id: 'x',
    title: '',
    body: '',
    folder: '',
    createdAt: Date.UTC(2024, 0, 1),
    updatedAt: Date.UTC(2024, 0, 2),
    clientSeq: 0,
    ...overrides,
  }
}

describe('noteToMarkdown', () => {
  it('emits a YAML frontmatter block followed by the body', () => {
    const md = noteToMarkdown(note({ title: 'Plan', body: '# Heading\n\nText.' }))
    expect(md).toMatch(/^---\n/)
    expect(md).toContain('title: "Plan"')
    expect(md).toContain('createdAt: 2024-01-01T00:00:00.000Z')
    expect(md).toContain('updatedAt: 2024-01-02T00:00:00.000Z')
    expect(md).toContain('---\n\n# Heading\n\nText.')
  })

  it('escapes embedded quotes and backslashes', () => {
    const md = noteToMarkdown(note({ title: 'a "quote" and \\ slash' }))
    expect(md).toContain('title: "a \\"quote\\" and \\\\ slash"')
  })

  it('collapses newlines inside the title to a single space', () => {
    const md = noteToMarkdown(note({ title: 'line1\nline2' }))
    expect(md).toContain('title: "line1 line2"')
  })

  it('falls back to "Untitled" when the title is empty', () => {
    const md = noteToMarkdown(note({ title: '', body: 'x' }))
    expect(md).toContain('title: "Untitled"')
  })
})

describe('safeFilenameBase', () => {
  it('sanitizes ordinary titles', () => {
    expect(safeFilenameBase('Normal Title')).toBe('Normal Title')
  })

  it('replaces slashes/backslashes with spaces', () => {
    expect(safeFilenameBase('has / slash and \\ back')).toBe('has slash and back')
  })

  it('replaces double-quotes with spaces', () => {
    expect(safeFilenameBase('quoted "title"')).toBe('quoted title')
  })

  it('trims and collapses whitespace', () => {
    expect(safeFilenameBase('  trim  me  ')).toBe('trim me')
  })

  it('strips trailing dots (Windows forbids)', () => {
    expect(safeFilenameBase('trailing dots...')).toBe('trailing dots')
  })

  it('drops control characters (NUL, DEL, ESC, ...)', () => {
    const withNul = `null${String.fromCharCode(0)}byte`
    const withDel = `del${String.fromCharCode(0x7f)}char`
    const withEsc = `esc${String.fromCharCode(0x1b)}seq`
    expect(safeFilenameBase(withNul)).toBe('null byte')
    expect(safeFilenameBase(withDel)).toBe('del char')
    expect(safeFilenameBase(withEsc)).toBe('esc seq')
  })

  it('returns "Untitled" for empty / whitespace-only input', () => {
    expect(safeFilenameBase('')).toBe('Untitled')
    expect(safeFilenameBase('   ')).toBe('Untitled')
    expect(safeFilenameBase('....')).toBe('Untitled')
    expect(safeFilenameBase('////')).toBe('Untitled')
  })

  it('truncates very long names', () => {
    const long = 'x'.repeat(200)
    expect(safeFilenameBase(long).length).toBe(80)
  })
})

describe('zipPathFor', () => {
  it('places the file at the root when folder is empty', () => {
    const p = zipPathFor(note({ id: 'aa', title: 'Plan' }), 'aa')
    expect(p).toBe('Plan-aa.md')
  })

  it('honors the folder field with forward slashes', () => {
    const p = zipPathFor(note({ id: 'bb', title: 'Notes', folder: '/Work/2024' }), 'bb')
    expect(p).toBe('Work/2024/Notes-bb.md')
  })

  it('rejects parent-dir segments without throwing', () => {
    const p = zipPathFor(note({ id: 'cc', title: 'evil', folder: '../../etc' }), 'cc')
    expect(p).toBe('etc/evil-cc.md')
  })

  it('handles backslashes as separators (legacy Windows paths)', () => {
    const p = zipPathFor(note({ id: 'dd', title: 't', folder: 'a\\b\\c' }), 'dd')
    expect(p).toBe('a/b/c/t-dd.md')
  })

  it('dedupes by appending the id (so two same-titled notes never collide)', () => {
    const a = zipPathFor(note({ id: 'a', title: 'Same' }), 'a')
    const b = zipPathFor(note({ id: 'b', title: 'Same' }), 'b')
    expect(a).not.toBe(b)
  })

  it('neutralizes a hostile id so it cannot smuggle path segments', () => {
    const evil = zipPathFor(note({ id: 'x', title: 'Plan' }), '../../etc/passwd')
    // Actual path separators are encoded — `..` as literal chars inside a
    // filename is harmless, but a `/` would create extra directories.
    expect(evil.split('/')).toHaveLength(1)
    expect(evil).not.toContain('\\')
    expect(evil.endsWith('.md')).toBe(true)
  })
})

describe('safeIdSuffix', () => {
  it('leaves nanoid-shaped ids alone', () => {
    expect(safeIdSuffix('V1StGXR8_Z5jdHi6B-myT')).toBe('V1StGXR8_Z5jdHi6B-myT')
  })

  it('percent-encodes forbidden chars', () => {
    expect(safeIdSuffix('a/b')).toBe('a%2Fb')
    expect(safeIdSuffix('a\\b')).toBe('a%5Cb')
    expect(safeIdSuffix('id with space')).toBe('id%20with%20space')
  })

  it('is injective — distinct inputs never produce the same output', () => {
    // The whole point: `a/b` and `a%2Fb` (a literal id containing `%`)
    // must NOT collide after passing through the helper.
    const slashy = safeIdSuffix('a/b')
    const literalPct = safeIdSuffix('a%2Fb')
    expect(slashy).not.toBe(literalPct)
    expect(slashy).toBe('a%2Fb')
    expect(literalPct).toBe('a%252Fb')
  })

  it('handles multi-byte UTF-8 cleanly', () => {
    // Japanese chars are 3 bytes each in UTF-8 → 9 hex chars per char.
    expect(safeIdSuffix('日本語')).toBe('%E6%97%A5%E6%9C%AC%E8%AA%9E')
  })

  it('falls back to "id" only for empty input', () => {
    expect(safeIdSuffix('')).toBe('id')
  })
})
