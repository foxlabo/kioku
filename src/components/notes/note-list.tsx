'use client'

import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import type { Note } from '@/lib/db/schema'
import { searchNotes } from '@/lib/notes/search'
import { NoteCard } from './note-card'

interface NoteListProps {
  notes: Note[]
  activeNoteId?: string
}

export function NoteList({ notes, activeNoteId }: NoteListProps) {
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    if (!query.trim()) return notes
    return searchNotes(notes, query)
  }, [notes, query])

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ノートを検索…"
          className="pl-8"
          aria-label="Search notes"
        />
      </div>
      <div className="flex-1 overflow-y-auto pr-1">
        {visible.length === 0 ? (
          <p className="px-2 py-4 text-sm text-zinc-500">
            {query.trim() ? '一致するノートはありません。' : 'ノートがまだありません。'}
          </p>
        ) : (
          <ul className="space-y-1">
            {visible.map((note) => (
              <li key={note.id}>
                <NoteCard note={note} active={note.id === activeNoteId} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
