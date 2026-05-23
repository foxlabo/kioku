import Link from 'next/link'
import { createBlankNoteAction } from '@/app/actions'
import { Button } from '@/components/ui/button'

// Confirmation page reached on GET; the actual create happens only when the
// user submits the form, so prefetch / accidental visits don't insert notes.
export const dynamic = 'force-dynamic'

export default function NewNotePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-zinc-900">新規ノートを作成</h1>
        <p className="mt-1 text-sm text-zinc-600">空のノートを作成して編集画面に移動します。</p>
        <form action={createBlankNoteAction} className="mt-4 flex gap-2">
          <Button type="submit" size="sm">
            作成して開く
          </Button>
          <Button asChild type="button" size="sm" variant="outline">
            <Link href="/">キャンセル</Link>
          </Button>
        </form>
      </div>
    </div>
  )
}
