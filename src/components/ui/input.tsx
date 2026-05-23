import type * as React from 'react'
import { cn } from '@/lib/utils'

export function Input({ className, type, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm shadow-sm transition-colors',
        'placeholder:text-zinc-500',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-400',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
