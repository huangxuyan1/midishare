/**
 * The player on the clip page: one panel with the transport and a read-only
 * piano roll with a moving playhead, and under it the same clip as sheet
 * music or as ABC text. The editor (ClipForm) puts the same pieces together
 * itself, with an editable roll.
 */
import { useMemo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { AbcView } from './AbcView'
import { PianoRoll } from './PianoRoll'
import { Transport } from './Transport'
import { checkAbc } from '@/lib/abc'
import { readHeaders } from '@/lib/abc-headers'
import { abcToNotes, barLengthInSteps } from '@/lib/abc-notes'
import { usePlayback } from '@/lib/use-playback'
import { LEGEND } from '@/lib/utils'

export function ClipPlayer({ abc }: { abc: string }) {
  const barSteps = barLengthInSteps(readHeaders(abc).meter)
  const playback = usePlayback(abc, barSteps)
  // The editor only saves ABC that parses, but a clip can also be written
  // through the API, so don't assume it does.
  const notes = useMemo(() => (checkAbc(abc).ok ? abcToNotes(abc) : []), [abc])

  return (
    <div className="flex flex-col gap-6" data-testid="clip-player">
      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
          <p className={LEGEND}>Piano roll</p>
          <Transport
            status={playback.status}
            position={playback.position}
            barSteps={barSteps}
            onPlay={playback.play}
            onStop={playback.stop}
            onReset={playback.reset}
          />
        </div>
        <PianoRoll notes={notes} barSteps={barSteps} playhead={playback.position} playing={playback.status === 'playing'} />
      </section>

      <Tabs defaultValue="sheet">
        <TabsList>
          <TabsTrigger value="sheet">Sheet music</TabsTrigger>
          <TabsTrigger value="abc">ABC text</TabsTrigger>
        </TabsList>
        <TabsContent value="sheet">
          <AbcView abc={abc} />
        </TabsContent>
        <TabsContent value="abc">
          <pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-roll p-4 font-mono text-sm leading-relaxed" data-testid="abc-text">
            {abc}
          </pre>
        </TabsContent>
      </Tabs>
    </div>
  )
}
