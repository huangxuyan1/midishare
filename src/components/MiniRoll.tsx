/**
 * A small piano roll that only shows a clip: no keyboard, no editing.
 * The clip cards and the landing page use it.
 *
 * The drawing uses one unit per 16th note across and one unit per semitone
 * down, and stretches to fill its box. It zooms to the pitches the clip uses.
 *
 * `sweep` adds a playhead that crosses the roll and turns the notes behind it
 * amber: 'always', or 'hover' (while the surrounding `group` element is
 * hovered). The animation is CSS only; see the end of styles.css.
 */
import type { Note } from '@/lib/abc-notes'
import { cn } from '@/lib/utils'

const MIN_ROWS = 12 // a clip with a narrow range still gets thin notes

type Props = {
  notes: Note[]
  /** Length of one bar in 16ths. */
  barSteps: number
  sweep?: 'always' | 'hover'
  /** How long one pass of the playhead takes. */
  sweepSeconds?: number
  className?: string
}

export function MiniRoll({ notes, barSteps, sweep, sweepSeconds = 4, className }: Props) {
  // Width: whole bars. Height: the clip's range, centered, with room to spare.
  const lastEnd = Math.max(barSteps, ...notes.map((n) => n.start + n.length))
  const steps = Math.ceil(lastEnd / barSteps) * barSteps
  const pitches = notes.map((n) => n.pitch)
  const highest = pitches.length ? Math.max(...pitches) : 60
  const lowest = pitches.length ? Math.min(...pitches) : 60
  const range = highest - lowest + 1
  const rows = Math.max(MIN_ROWS, range + 2)
  const topPitch = highest + Math.floor((rows - range) / 2) // the pitch drawn in the first row
  const viewBox = `0 0 ${steps} ${rows}`

  const noteRects = (className: string) =>
    notes.map((n, i) => (
      <rect key={i} x={n.start + 0.1} y={topPitch - n.pitch + 0.1} width={n.length - 0.2} height={0.8} className={className} />
    ))

  return (
    <div
      aria-hidden
      className={cn('relative overflow-hidden bg-roll', sweep === 'always' && 'roll-sweep-always', sweep === 'hover' && 'roll-sweep-hover', className)}
      style={sweep ? { animationDuration: `${sweepSeconds}s` } : undefined}
    >
      <svg viewBox={viewBox} preserveAspectRatio="none" className="absolute inset-0 size-full">
        {/* A line at the start of every bar after the first. */}
        {Array.from({ length: steps / barSteps - 1 }, (_, i) => (
          <line
            key={i}
            x1={(i + 1) * barSteps}
            x2={(i + 1) * barSteps}
            y1={0}
            y2={rows}
            className="stroke-roll-line"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {noteRects('fill-note')}
      </svg>

      {sweep && (
        <>
          {/* The same notes in amber, revealed up to the playhead. */}
          <svg viewBox={viewBox} preserveAspectRatio="none" className="roll-sweep-lit absolute inset-0 size-full">
            {noteRects('fill-primary')}
          </svg>
          <div className="roll-sweep-head absolute inset-y-0 w-0.5 bg-primary" />
        </>
      )}
    </div>
  )
}
