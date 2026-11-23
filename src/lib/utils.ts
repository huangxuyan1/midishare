import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/** Classes for a small uppercase label, like the lettering on a hardware panel. */
export const LEGEND = 'font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground'
