'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Bot, Loader2, Send, Sparkles, User } from 'lucide-react'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const SUGGESTIONS = ['プロジェクトのToDoは？', '今週のメモを要約して', 'Kioku の特徴を教えて']

export function AskPanel() {
  const [input, setInput] = useState('')
  const { messages, sendMessage, status, stop, clearError, setMessages, regenerate, error } =
    useChat({
      transport: new DefaultChatTransport({ api: '/api/notes/ask' }),
    })

  const busy = status === 'submitted' || status === 'streaming'

  function onSubmit(text: string) {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    clearError()
    void sendMessage({ text: trimmed })
    setInput('')
  }

  return (
    <section className="flex h-full flex-col bg-white">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-zinc-700" />
          <h2 className="text-sm font-semibold text-zinc-900">Ask your notes</h2>
        </div>
        {messages.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setMessages([])}>
            クリア
          </Button>
        )}
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-3 text-sm text-zinc-600">
            <p>ノートに書かれた内容について質問できます。</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSubmit(s)}
                  className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="space-y-4">
            {messages.map((m) => (
              <li key={m.id} className="flex gap-3">
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full border',
                    m.role === 'user'
                      ? 'border-zinc-300 bg-zinc-100 text-zinc-700'
                      : 'border-zinc-900 bg-zinc-900 text-white',
                  )}
                  aria-hidden
                >
                  {m.role === 'user' ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
                </span>
                <div className="flex-1">
                  <p className="mb-1 text-xs font-medium text-zinc-500">
                    {m.role === 'user' ? 'You' : 'Kioku'}
                  </p>
                  <MessageBody text={extractText(m)} />
                </div>
              </li>
            ))}
            {busy && (
              <li className="flex items-center gap-2 text-xs text-zinc-500">
                <Loader2 className="size-3 animate-spin" /> 考え中…
              </li>
            )}
          </ul>
        )}
        {error && !busy && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
          >
            <span className="flex-1">
              リクエスト中にエラーが発生しました。サーバーログを確認してください。
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                clearError()
                void regenerate()
              }}
            >
              再試行
            </Button>
            <Button size="sm" variant="ghost" onClick={() => clearError()}>
              閉じる
            </Button>
          </div>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(input)
        }}
        className="flex items-end gap-2 border-t border-zinc-200 bg-zinc-50 px-3 py-3"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSubmit(input)
            }
          }}
          placeholder="ノートについて質問する… (Shift+Enter で改行)"
          rows={2}
          className="resize-none text-sm"
          aria-label="Ask a question"
        />
        {busy ? (
          <Button type="button" variant="outline" size="sm" onClick={() => stop()}>
            停止
          </Button>
        ) : (
          <Button type="submit" size="sm" disabled={!input.trim()}>
            <Send className="size-3.5" /> 送信
          </Button>
        )}
      </form>
    </section>
  )
}

interface UIMessageLike {
  parts?: Array<{ type: string; text?: string }>
  content?: string
}

function extractText(m: UIMessageLike): string {
  if (Array.isArray(m.parts)) {
    return m.parts
      .filter((p) => p.type === 'text' && typeof p.text === 'string')
      .map((p) => p.text)
      .join('')
  }
  if (typeof m.content === 'string') return m.content
  return ''
}

function MessageBody({ text }: { text: string }) {
  if (!text) return <p className="text-sm text-zinc-400">…</p>
  return (
    <div className="prose prose-sm prose-zinc prose-kioku max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  )
}
