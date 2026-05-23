import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge Tailwind classes with conditional + conflict-resolved logic. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
