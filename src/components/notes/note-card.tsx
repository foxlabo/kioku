import Link from 'next/link'
import type { Note } from '@/lib/db/schema'
import { cn } from '@/lib/utils'

interface NoteCardProps {
  note: Note
  active?: boolean
}

const PREVIEW_LENGTH = 120

function formatDate(ms: number): string {
  const d = new Date(ms)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
}

function buildPreview(body: string): string {
  const stripped = body
    .replace(/^#+\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
  return stripped.length > PREVIEW_LENGTH ? `${stripped.slice(0, PREVIEW_LENGTH)}…` : stripped
}

export function NoteCard({ note, active = false }: NoteCardProps) {
  const preview = buildPreview(note.body)
  return (
    <Link
      href={`/notes/${note.id}`}
      className={cn(
        'block rounded-md border border-transparent px-3 py-2 text-left transition-colors',
        active ? 'border-zinc-300 bg-white shadow-sm' : 'hover:bg-zinc-100',
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="truncate text-sm font-medium text-zinc-900">{note.title || 'Untitled'}</h3>
        <span className="shrink-0 text-xs text-zinc-500">{formatDate(note.updatedAt)}</span>
      </div>
      {preview && <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{preview}</p>}
      {note.folder && (
        <span className="mt-1 inline-block rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-600">
          {note.folder}
        </span>
      )}
    </Link>
  )
}
