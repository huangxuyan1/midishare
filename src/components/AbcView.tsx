/**
 * Renders ABC as sheet music and adds a Play/Stop button.
 * Used for the live preview on the create/edit form and on the clip page.
 */
import { useEffect, useRef, useState } from 'react'
import abcjs from 'abcjs'
import { Play, Square } from 'lucide-react'
import { Button } from '@/components/ui'

export function AbcView({ abc }: { abc: string }) {
  const paperRef = useRef<HTMLDivElement>(null)
  const tuneRef = useRef<abcjs.TuneObject | null>(null)
  const synthRef = useRef<abcjs.MidiBuffer | null>(null)
  const [playing, setPlaying] = useState(false)
  const [loadingAudio, setLoadingAudio] = useState(false)

  // Redraw the notation whenever the ABC changes, and stop any playback.
  useEffect(() => {
    if (!paperRef.current) return
    const [tune] = abcjs.renderAbc(paperRef.current, abc, { responsive: 'resize', add_classes: true })
    tuneRef.current = tune ?? null
    return () => {
      synthRef.current?.stop()
      setPlaying(false)
    }
  }, [abc])

  async function play() {
    if (!tuneRef.current || !abcjs.synth.supportsAudio()) return
    setLoadingAudio(true)
    try {
      const synth = new abcjs.synth.CreateSynth()
      // Loads the instrument samples, then renders the audio buffer.
      await synth.init({ visualObj: tuneRef.current, onEnded: () => setPlaying(false) })
      await synth.prime()
      synthRef.current?.stop()
      synthRef.current = synth
      synth.start()
      setPlaying(true)
    } finally {
      setLoadingAudio(false)
    }
  }

  function stop() {
    synthRef.current?.stop()
    setPlaying(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <div ref={paperRef} data-testid="abc-notation" className="rounded-md bg-white p-2 text-black" />
      <div>
        {playing ? (
          <Button variant="secondary" onClick={stop}>
            <Square className="size-4" /> Stop
          </Button>
        ) : (
          <Button variant="secondary" onClick={play} disabled={loadingAudio}>
            <Play className="size-4" /> {loadingAudio ? 'Loading sound…' : 'Play'}
          </Button>
        )}
      </div>
    </div>
  )
}
