import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kioku — Local AI notes',
  description:
    'Local Markdown notes with an AI panel that answers questions grounded in your own notes.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja" className="h-full">
      <body className="min-h-full bg-zinc-50 text-zinc-900 antialiased">{children}</body>
    </html>
  )
}
