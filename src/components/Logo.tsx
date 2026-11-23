/** The midishare mark (three notes stepping up, as on a piano roll) and the wordmark. */
import { APP_NAME } from '@/constants'
import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-mono text-sm font-semibold tracking-tight text-foreground', className)}>
      <svg viewBox="0 0 22 16" className="h-4 w-[22px]" aria-hidden>
        <rect x="0" y="12" width="9" height="4" rx="1" className="fill-primary" />
        <rect x="7" y="6" width="9" height="4" rx="1" className="fill-primary" />
        <rect x="14" y="0" width="8" height="4" rx="1" className="fill-primary" />
      </svg>
      {APP_NAME}
    </span>
  )
}
