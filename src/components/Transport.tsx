/**
 * Play / Stop / Reset buttons and a bar.beat counter, shown above the piano roll.
 */
import { Play, SkipBack, Square } from 'lucide-react'
import { Button } from '@/components/ui'
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

  return (
    <div className="flex items-center gap-2" data-testid="transport">
      <Button size="sm" variant="secondary" onClick={onReset} title="Back to the start">
        <SkipBack className="size-4" /> Reset
      </Button>
      {status === 'playing' ? (
        <Button size="sm" onClick={onStop}>
          <Square className="size-4" /> Stop
        </Button>
      ) : (
        <Button size="sm" onClick={onPlay} disabled={status === 'loading'}>
          <Play className="size-4" /> {status === 'loading' ? 'Loading sound…' : 'Play'}
        </Button>
      )}
      <span className="ml-2 font-mono text-sm tabular-nums text-muted-foreground" data-testid="position">
        {bar}.{beat}
      </span>
    </div>
  )
}
