import type { Note } from '@/lib/db/schema'

/** Hard cap so a single note can't blow past most filesystems' name limits. */
const MAX_FILENAME_BASE = 80

/**
 * Render a Note as a Markdown file with a YAML frontmatter block. Pure —
 * no I/O. Used both for single-note download and bulk-ZIP entries.
 *
 * Frontmatter is intentionally minimal: title, folder, createdAt,
 * updatedAt. Keeps round-trip simple if the user ever wants to re-import.
 */
export function noteToMarkdown(note: Note): string {
  const lines = [
    '---',
    `title: ${yamlString(note.title || 'Untitled')}`,
    `folder: ${yamlString(note.folder ?? '')}`,
    `createdAt: ${new Date(note.createdAt).toISOString()}`,
    `updatedAt: ${new Date(note.updatedAt).toISOString()}`,
    '---',
    '',
    note.body ?? '',
  ]
  return lines.join('\n')
}

/** Escape a value for a single-line YAML scalar. We quote everything to
 *  avoid surprises with leading `#`, `&`, `*`, etc. */
function yamlString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ')}"`
}

/** Characters Windows / most filesystems forbid in filenames, plus the
 *  path separators we definitely don't want in a basename. */
const FORBIDDEN_FILENAME_CHARS = '<>:"/\\|?*'

/**
 * Make a filesystem-safe file name from a note title. Strips path
 * separators, NULs, control characters, and Windows-forbidden characters
 * (`<>:"/\\|?*`), collapses whitespace, and trims to {@link
 * MAX_FILENAME_BASE} characters. Returns 'Untitled' for empty input.
 */
export function safeFilenameBase(title: string): string {
  // Walk char-by-char so we can drop control characters (code points < 0x20)
  // and the DEL (0x7f) without needing a regex range — keeps the linter happy
  // and avoids the persisted-bytes-in-source-file footgun.
  let cleaned = ''
  for (const ch of title) {
    const cp = ch.codePointAt(0) ?? 0
    if (cp < 0x20 || cp === 0x7f) {
      cleaned += ' '
      continue
    }
    cleaned += FORBIDDEN_FILENAME_CHARS.includes(ch) ? ' ' : ch
  }
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  if (!cleaned) return 'Untitled'
  // Windows also disallows trailing dots; strip them.
  const trimmed = cleaned.replace(/\.+$/, '').trim()
  if (!trimmed) return 'Untitled'
  return trimmed.slice(0, MAX_FILENAME_BASE)
}

/** Reduce an opaque id to characters safe inside a filename. The suffix
 *  exists to keep same-titled notes from colliding in the ZIP, so the
 *  transform MUST be injective — `a/b` and `a_b` must not produce the
 *  same output. We percent-encode anything outside `[A-Za-z0-9_-]` (and
 *  the `%` itself), which gives a reversible mapping. `%` is valid in
 *  filenames on all major filesystems. Returns `'id'` for empty input. */
export function safeIdSuffix(id: string): string {
  if (!id) return 'id'
  let out = ''
  for (const ch of id) {
    const code = ch.codePointAt(0) ?? 0
    if (
      (code >= 0x30 && code <= 0x39) /* 0-9 */ ||
      (code >= 0x41 && code <= 0x5a) /* A-Z */ ||
      (code >= 0x61 && code <= 0x7a) /* a-z */ ||
      ch === '_' ||
      ch === '-'
    ) {
      out += ch
    } else {
      // encodeURIComponent handles multi-byte UTF-8 correctly; we
      // additionally encode `%` itself so the mapping stays injective
      // (`encodeURIComponent('%')` is `%25`, which is what we want).
      out += encodeURIComponent(ch)
    }
  }
  return out
}

/**
 * Map a note to a slash-separated path inside the ZIP archive, honoring
 * the `folder` field. Forbids absolute paths and `..` segments — even
 * though the values came from our DB, we treat them as untrusted by
 * default since a future feature could let users edit them.
 */
export function zipPathFor(note: Note, idForDedup: string): string {
  const segments: string[] = []
  if (note.folder) {
    for (const raw of note.folder.split(/[/\\]+/)) {
      const part = raw.trim()
      if (!part || part === '.' || part === '..') continue
      segments.push(safeFilenameBase(part))
    }
  }
  // `safeFilenameBase` ensures the title can't contain a slash, and
  // `safeIdSuffix` ensures the id suffix can't either — even if a future
  // importer accepts ids from outside the app.
  const file = `${safeFilenameBase(note.title || 'Untitled')}-${safeIdSuffix(idForDedup)}.md`
  segments.push(file)
  return segments.join('/')
}
