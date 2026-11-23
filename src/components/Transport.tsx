/**
 * Play / Stop / Reset buttons and a bar.beat counter, shown above the piano roll.
 * The space bar also toggles play/stop.
 */
import { useEffect, useRef } from 'react'
import { Play, SkipBack, Square } from 'lucide-react'
import { Button } from '@/components/ui'
import { Tip } from './Tip'
import type { PlaybackStatus } from '@/lib/use-playback'

type Props = {
  status: PlaybackStatus
  /** Playhead, in 16th-note steps. */
  position: number
  barSteps: number
  onPlay: () => void
  onStop: () => void
  onReset: () => void
}

export function Transport({ status, position, barSteps, onPlay, onStop, onReset }: Props) {
  const step = Math.floor(position)
  const bar = Math.floor(step / barSteps) + 1
  const beat = Math.floor((step % barSteps) / 4) + 1 // quarter-note beats

  // The key listener is added once, so it reads the current action from a ref
  // that every render refreshes.
  const toggle = useRef(() => {})
  toggle.current = () => {
    if (status === 'playing') onStop()
    else if (status === 'stopped') onPlay()
  }
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space' || e.repeat || usesSpaceItself(e.target)) return
      e.preventDefault() // otherwise the page scrolls
      toggle.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="flex items-center gap-2" data-testid="transport">
      <Tip text="Back to the start">
        <Button size="sm" variant="ghost" onClick={onReset}>
          <SkipBack className="size-4" /> Reset
        </Button>
      </Tip>
      {/* Amber means "playing": Stop is lit, Play is not. */}
      {status === 'playing' ? (
        <Tip text="Stop (space bar)">
          <Button size="sm" className="w-24" onClick={onStop}>
            <Square className="size-4" /> Stop
          </Button>
        </Tip>
      ) : (
        <Tip text="Play (space bar)">
          <Button size="sm" variant="outline" className="w-24" onClick={onPlay} loading={status === 'loading'}>
            {status !== 'loading' && <Play className="size-4 text-primary" />} Play
          </Button>
        </Tip>
      )}
      {/* The counter, styled like a small display: bar.beat */}
      <span
        className="rounded-md border border-border bg-roll px-2.5 py-1.5 font-mono text-sm tabular-nums text-primary"
        data-testid="position"
      >
        {bar}.{beat}
      </span>
    </div>
  )
}

/**
 * True when the focused element needs the space bar: text fields type it,
 * and buttons, links and dropdowns are activated by it.
 */
function usesSpaceItself(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target.closest('input, textarea, select, button, a') !== null
}
