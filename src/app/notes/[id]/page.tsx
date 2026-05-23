import { ArrowLeft, Plus } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { NoteEditor } from '@/components/notes/note-editor'
import { NoteList } from '@/components/notes/note-list'
import { Button } from '@/components/ui/button'
import { ensureDbReady } from '@/lib/db/init'
import { getNote, listNotes } from '@/lib/db/queries'

// Notes come from the local SQLite — render fresh each request.
export const dynamic = 'force-dynamic'

interface NotePageProps {
  params: Promise<{ id: string }>
}

export default async function NotePage({ params }: NotePageProps) {
  ensureDbReady()
  const { id } = await params
  const note = getNote(id)
  if (!note) notFound()
  const notes = listNotes()

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-2">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <ArrowLeft className="size-4" /> Kioku
        </Link>
        <Button asChild size="sm" variant="outline">
          <Link href="/notes/new">
            <Plus className="size-3.5" /> 新規ノート
          </Link>
        </Button>
      </header>
      <div className="grid flex-1 grid-cols-[280px_1fr] overflow-hidden">
        <aside className="border-r border-zinc-200 bg-zinc-50 p-3">
          <NoteList notes={notes} activeNoteId={note.id} />
        </aside>
        <main className="overflow-hidden">
          {/* key forces a full remount when the route changes to a different note,
              so autosave refs (in-flight, pending, seq) can't leak across notes. */}
          <NoteEditor key={note.id} note={note} />
        </main>
      </div>
    </div>
  )
}
