/**
 * The landing page's hero visual: one clip shown twice, as a piano roll with
 * a playhead running across it and as the ABC text underneath. It is built
 * from the app's own MiniRoll, not a screenshot.
 */
import { MiniRoll } from '@/components/MiniRoll'
import { DEMO_ABC, DEMO_BAR_STEPS, DEMO_KEY, DEMO_METER, DEMO_NOTES, DEMO_SECONDS, DEMO_TEMPO, DEMO_TITLE } from './demo-clip'

export function DemoClip() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card" data-testid="demo-clip">
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
        <span className="font-mono text-sm font-medium">{DEMO_TITLE}</span>
        <span className="font-mono text-xs text-muted-foreground">
          {DEMO_KEY} · {DEMO_METER} · {DEMO_TEMPO} BPM
        </span>
      </div>
      <MiniRoll notes={DEMO_NOTES} barSteps={DEMO_BAR_STEPS} sweep="always" sweepSeconds={DEMO_SECONDS} className="h-56 sm:h-64" />
      <pre className="overflow-x-auto border-t border-border bg-roll px-4 py-3 font-mono text-xs leading-relaxed text-muted-foreground">
        {DEMO_ABC}
      </pre>
    </div>
  )
}
