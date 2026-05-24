'use client'

import { Download, Eye, FilePen, Loader2, Save, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { deleteNoteAction, updateNoteAction } from '@/app/actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { Note } from '@/lib/db/schema'
import { cn } from '@/lib/utils'

interface NoteEditorProps {
  note: Note
}

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string }
  /** Server reported the write was beaten by another (e.g. a second tab).
   *  Local edits are NOT saved; the user should reload to pick up the
   *  remote state before continuing. */
  | { kind: 'conflict' }

const AUTOSAVE_DELAY_MS = 800
/** Fetch spec caps total keepalive request bodies at 64 KiB. We leave a 4 KiB
 *  buffer for headers and other parallel keepalive traffic. */
const KEEPALIVE_BUDGET = 60 * 1024

export function NoteEditor({ note }: NoteEditorProps) {
  const router = useRouter()
  const [title, setTitle] = useState(note.title)
  const [body, setBody] = useState(note.body)
  const [folder, setFolder] = useState(note.folder)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' })
  const [downloading, setDownloading] = useState(false)
  const [, startTransition] = useTransition()

  // The editor remounts (via key={note.id} on the parent) when the active
  // note changes, so all refs below are scoped to a single note's lifetime.
  // That eliminates the cross-note save races a single shared editor would have.
  const noteIdRef = useRef(note.id)
  const latest = useRef({ title, body, folder })
  latest.current = { title, body, folder }
  const lastSaved = useRef({ title: note.title, body: note.body, folder: note.folder })
  // Monotonic seq so a slower earlier save can't overwrite a faster later one.
  // Seeded from the persisted `client_seq` so a fresh mount (page reload or
  // route remount) keeps issuing strictly-increasing seqs the DB will accept.
  const saveSeq = useRef(note.clientSeq)
  const inFlightSeq = useRef<number | null>(null)
  const pending = useRef(false)
  const unmountedRef = useRef(false)
  // Set once the server reports a stale write. Conflict is terminal — no
  // further save attempts run until the user reloads, otherwise we'd race
  // again with the newer remote state and could overwrite it.
  const conflictedRef = useRef(false)

  const save = useCallback(async () => {
    if (unmountedRef.current || conflictedRef.current) return
    if (inFlightSeq.current !== null) {
      // Another save is on the wire — let its finally chase the latest snapshot.
      pending.current = true
      return
    }
    const snapshot = { ...latest.current }
    if (
      snapshot.title === lastSaved.current.title &&
      snapshot.body === lastSaved.current.body &&
      snapshot.folder === lastSaved.current.folder
    ) {
      return
    }
    const seq = ++saveSeq.current
    inFlightSeq.current = seq
    setSaveState({ kind: 'saving' })
    try {
      const result = await updateNoteAction({
        id: noteIdRef.current,
        ...snapshot,
        clientSeq: seq,
      })
      // Drop the response if the component has unmounted or a newer save was queued.
      if (unmountedRef.current || seq !== saveSeq.current) return
      if (!result.ok) {
        setSaveState({ kind: 'error', message: result.error ?? 'Save failed.' })
        return
      }
      if (result.stale) {
        // The server rejected our write because a newer one already won
        // (typically a second tab open on the same note). Latch into a
        // terminal conflict state — further saves would only widen the
        // divergence — until the user reloads.
        conflictedRef.current = true
        pending.current = false
        setSaveState({ kind: 'conflict' })
        return
      }
      lastSaved.current = snapshot
      setSaveState({ kind: 'saved', at: Date.now() })
    } finally {
      // Only the latest in-flight save clears the slot. A stale older save
      // returning late must not allow a concurrent newer save to start.
      if (inFlightSeq.current === seq) {
        inFlightSeq.current = null
        if (!unmountedRef.current && !conflictedRef.current && pending.current) {
          pending.current = false
          void save()
        }
      }
    }
  }, [])

  /** Trigger the queued + chained-pending sequence to drain. Returns true
   *  when local state matches the persisted state at the end of the wait,
   *  false on save error, conflict, or timeout. Used by the export button
   *  so a click immediately after typing downloads the freshly-persisted
   *  version, not a stale one. */
  const flushAndWait = useCallback(async (): Promise<boolean> => {
    if (conflictedRef.current) return false
    const startedAt = Date.now()
    void save()
    while (inFlightSeq.current !== null || pending.current) {
      if (conflictedRef.current) return false
      if (Date.now() - startedAt > 5_000) return false
      await new Promise((r) => setTimeout(r, 50))
    }
    // Final invariant: nothing dirty remains. Returns false if a save
    // error left the buffer un-flushed.
    const l = latest.current
    const s = lastSaved.current
    return l.title === s.title && l.body === s.body && l.folder === s.folder
  }, [save])

  async function downloadMarkdown(): Promise<void> {
    if (downloading) return
    setDownloading(true)
    try {
      const ok = await flushAndWait()
      if (!ok) {
        // Surface the SaveIndicator-driven error / conflict UI; don't
        // download a snapshot we know is out of sync with the editor.
        setSaveState({
          kind: 'error',
          message: 'ダウンロード前の保存に失敗したため中止しました。',
        })
        return
      }
      const a = document.createElement('a')
      a.href = `/api/notes/${encodeURIComponent(noteIdRef.current)}/export`
      a.rel = 'noopener'
      a.download = ''
      document.body.appendChild(a)
      a.click()
      a.remove()
    } finally {
      setDownloading(false)
    }
  }

  // Debounced autosave.
  useEffect(() => {
    const dirty =
      title !== lastSaved.current.title ||
      body !== lastSaved.current.body ||
      folder !== lastSaved.current.folder
    if (!dirty) return
    const handle = window.setTimeout(() => {
      void save()
    }, AUTOSAVE_DELAY_MS)
    return () => window.clearTimeout(handle)
  }, [title, body, folder, save])

  // Ctrl/Cmd+S manual save.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save])

  // Flush any pending dirty edits before the editor unmounts (navigation
  // within the SPA) and before the tab closes / reloads. Each flush gets its
  // own monotonic seq, so even if it arrives at the server out of order
  // relative to an in-flight save, the DB layer drops the stale one.
  useEffect(() => {
    function flush(viaKeepalive: boolean): { sent: boolean } {
      // Once in conflict, do not POST anything else — the local buffer
      // disagrees with the authoritative remote and a flush would clobber it.
      if (conflictedRef.current) return { sent: true }
      const { title: t, body: b, folder: f } = latest.current
      if (
        t === lastSaved.current.title &&
        b === lastSaved.current.body &&
        f === lastSaved.current.folder
      ) {
        return { sent: true }
      }
      const seq = ++saveSeq.current
      const payload = JSON.stringify({
        id: noteIdRef.current,
        title: t,
        body: b,
        folder: f,
        clientSeq: seq,
      })
      // The Fetch spec caps total in-flight keepalive bodies at 64 KiB —
      // measured in BYTES, not UTF-16 code units. Japanese/emoji-heavy
      // payloads can easily 2-3× their string length when encoded, so we
      // must measure the encoded size. If we'd exceed the budget, we cannot
      // safely send via keepalive (the browser would silently drop it).
      // Return sent: false so the caller can warn the user before they close.
      const payloadBytes = new TextEncoder().encode(payload).byteLength
      if (viaKeepalive && payloadBytes > KEEPALIVE_BUDGET) {
        return { sent: false }
      }
      void fetch('/api/notes/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload,
        keepalive: viaKeepalive,
      })
      lastSaved.current = { title: t, body: b, folder: f }
      return { sent: true }
    }
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const result = flush(true)
      if (!result.sent) {
        // Modern browsers ignore the message text but still show a generic
        // "Leave site?" prompt when preventDefault is called.
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      unmountedRef.current = true
      flush(false)
    }
  }, [])

  const onDelete = () => {
    startTransition(async () => {
      await deleteNoteAction({ id: note.id })
      router.push('/')
    })
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-4 py-3">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="タイトル"
          className="h-9 max-w-md text-base font-medium"
          aria-label="Note title"
        />
        <Input
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          placeholder="フォルダ (例: /Work)"
          className="h-9 max-w-xs text-sm"
          aria-label="Note folder"
        />
        <div className="ml-auto flex items-center gap-2">
          <SaveIndicator state={saveState} />
          <div className="flex rounded-md border border-zinc-200 p-0.5">
            <button
              type="button"
              onClick={() => setMode('edit')}
              className={cn(
                'flex items-center gap-1 rounded px-2 py-1 text-xs',
                mode === 'edit' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100',
              )}
              aria-pressed={mode === 'edit'}
            >
              <FilePen className="size-3.5" /> 編集
            </button>
            <button
              type="button"
              onClick={() => setMode('preview')}
              className={cn(
                'flex items-center gap-1 rounded px-2 py-1 text-xs',
                mode === 'preview' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100',
              )}
              aria-pressed={mode === 'preview'}
            >
              <Eye className="size-3.5" /> プレビュー
            </button>
          </div>
          <Button size="sm" variant="outline" onClick={() => void save()}>
            <Save className="size-3.5" /> 保存
          </Button>
          <Button
            size="sm"
            variant="outline"
            aria-label="このノートを .md でダウンロード"
            disabled={downloading}
            onClick={() => void downloadMarkdown()}
          >
            <Download className="size-3.5" /> .md
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="destructive" aria-label="Delete note">
                <Trash2 className="size-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>ノートを削除しますか？</DialogTitle>
                <DialogDescription>
                  「{title || 'Untitled'}」を完全に削除します。この操作は元に戻せません。
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="destructive" onClick={onDelete}>
                  削除する
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>
      <div className="flex-1 overflow-hidden">
        {mode === 'edit' ? (
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Markdownで書く…"
            className="h-full w-full resize-none rounded-none border-0 px-6 py-4 text-sm font-mono focus-visible:ring-0"
            aria-label="Note body"
          />
        ) : (
          <div className="h-full overflow-y-auto px-6 py-4">
            <article className="prose prose-zinc prose-kioku max-w-3xl">
              {body.trim() ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                  {body}
                </ReactMarkdown>
              ) : (
                <p className="text-zinc-400">プレビューはここに表示されます。</p>
              )}
            </article>
          </div>
        )}
      </div>
    </div>
  )
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state.kind === 'saving') {
    return (
      <span className="flex items-center gap-1 text-xs text-zinc-500">
        <Loader2 className="size-3 animate-spin" /> 保存中…
      </span>
    )
  }
  if (state.kind === 'saved') {
    return <span className="text-xs text-zinc-400">保存済み</span>
  }
  if (state.kind === 'conflict') {
    return (
      <span className="text-xs text-amber-700">
        他の編集が優先されました。ページを更新してください。
      </span>
    )
  }
  if (state.kind === 'error') {
    return <span className="text-xs text-red-600">エラー: {state.message}</span>
  }
  return null
}
