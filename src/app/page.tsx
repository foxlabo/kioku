import { Download, Plus, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { AskPanel } from '@/components/notes/ask-panel'
import { NoteList } from '@/components/notes/note-list'
import { Button } from '@/components/ui/button'
import { ensureDbReady } from '@/lib/db/init'
import { listNotes } from '@/lib/db/queries'

// Notes come from the local SQLite — render fresh each request.
export const dynamic = 'force-dynamic'

export default function HomePage() {
  ensureDbReady()
  const notes = listNotes()

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-2">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <Sparkles className="size-4 text-zinc-700" />
          Kioku
        </Link>
        <div className="flex items-center gap-2">
          {notes.length > 0 && (
            <Button asChild size="sm" variant="outline" aria-label="全ノートを ZIP でダウンロード">
              <a href="/api/notes/export" download>
                <Download className="size-3.5" /> 全件 ZIP
              </a>
            </Button>
          )}
          <Button asChild size="sm" variant="default">
            <Link href="/notes/new">
              <Plus className="size-3.5" /> 新規ノート
            </Link>
          </Button>
        </div>
      </header>
      <div className="grid flex-1 grid-cols-[280px_1fr_360px] overflow-hidden">
        <aside className="border-r border-zinc-200 bg-zinc-50 p-3">
          <NoteList notes={notes} />
        </aside>
        <main className="overflow-y-auto p-6">
          <h1 className="text-2xl font-semibold text-zinc-900">Kioku</h1>
          <p className="mt-2 max-w-prose text-sm text-zinc-600">
            ローカルに保存される Markdown ノートと、それを根拠に回答する AI パネル。
            左のサイドバーからノートを開くか、右のパネルで質問してみてください。
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <StatCard label="ノート数" value={String(notes.length)} />
            <StatCard
              label="最新の更新"
              value={
                notes[0]
                  ? new Date(notes[0].updatedAt).toLocaleString('ja-JP', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—'
              }
            />
          </div>
          <h2 className="mt-10 text-sm font-semibold text-zinc-700">最近のノート</h2>
          <ul className="mt-3 grid gap-2">
            {notes.slice(0, 6).map((n) => (
              <li key={n.id}>
                <Link
                  href={`/notes/${n.id}`}
                  className="block rounded-md border border-zinc-200 bg-white px-3 py-2 hover:bg-zinc-50"
                >
                  <div className="text-sm font-medium text-zinc-900">{n.title || 'Untitled'}</div>
                  <div className="mt-1 line-clamp-1 text-xs text-zinc-500">
                    {n.body.replace(/\s+/g, ' ').slice(0, 140)}
                  </div>
                </Link>
              </li>
            ))}
            {notes.length === 0 && (
              <li className="text-sm text-zinc-500">
                ノートがまだありません。「新規ノート」から作成できます。
              </li>
            )}
          </ul>
        </main>
        <aside className="border-l border-zinc-200">
          <AskPanel />
        </aside>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-zinc-900">{value}</div>
    </div>
  )
}
