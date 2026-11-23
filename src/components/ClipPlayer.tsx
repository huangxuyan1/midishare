/**
 * The player on the clip page: transport, a read-only piano roll with a moving
 * playhead, and the sheet music. The editor (ClipForm) puts the same pieces
 * together itself, with an editable roll.
 */
import { useMemo } from 'react'
import { AbcView } from './AbcView'
import { PianoRoll } from './PianoRoll'
import { Transport } from './Transport'
import { checkAbc } from '@/lib/abc'
import { readHeaders } from '@/lib/abc-headers'
import { abcToNotes, barLengthInSteps } from '@/lib/abc-notes'
import { usePlayback } from '@/lib/use-playback'

export function ClipPlayer({ abc }: { abc: string }) {
  const barSteps = barLengthInSteps(readHeaders(abc).meter)
  const playback = usePlayback(abc, barSteps)
  // The editor only saves ABC that parses, but a clip can also be written
  // through the API, so don't assume it does.
  const notes = useMemo(() => (checkAbc(abc).ok ? abcToNotes(abc) : []), [abc])

  return (
    <div className="flex flex-col gap-3" data-testid="clip-player">
      <Transport
        status={playback.status}
        position={playback.position}
        barSteps={barSteps}
        onPlay={playback.play}
        onStop={playback.stop}
        onReset={playback.reset}
      />
      <PianoRoll notes={notes} barSteps={barSteps} playhead={playback.position} playing={playback.status === 'playing'} />
      <AbcView abc={abc} />
    </div>
  )
}
