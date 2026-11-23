/**
 * Plays ABC with the abcjs synth, like a DAW transport:
 * - play starts from the playhead
 * - stop pauses and leaves the playhead where it is
 * - reset stops and moves the playhead back to the start
 *
 * `position` is the playhead in 16th-note steps (the piano roll's grid), updated
 * every animation frame while playing. It is computed from the clock, not read
 * from the audio, using the tune's own milliseconds-per-bar.
 *
 * abcjs's onEnded callback also fires on a manual stop, so the end of the
 * music is detected here from the synth's duration instead.
 */
import { useEffect, useRef, useState } from 'react'
import abcjs from 'abcjs'

export type PlaybackStatus = 'stopped' | 'loading' | 'playing'

export function usePlayback(abc: string, barSteps: number) {
  const [status, setStatus] = useState<PlaybackStatus>('stopped')
  const [position, setPosition] = useState(0)

  const synth = useRef<abcjs.MidiBuffer | null>(null)
  const synthAbc = useRef<string | null>(null) // the ABC the synth's audio was built from
  const durationMs = useRef(0)
  const msPerStep = useRef(0)
  const frame = useRef(0)

  function stopAudio() {
    synth.current?.stop()
    cancelAnimationFrame(frame.current)
  }

  // Editing the music stops playback; the next play rebuilds the audio.
  // Leaving the page stops it too.
  useEffect(() => {
    return () => {
      stopAudio()
      setStatus('stopped')
    }
  }, [abc])

  async function play() {
    const [tune] = abcjs.parseOnly(abc)
    if (!tune || !abcjs.synth.supportsAudio()) return

    if (synthAbc.current !== abc) {
      setStatus('loading')
      const next = new abcjs.synth.CreateSynth()
      // Loads the instrument samples, then renders the audio buffer.
      await next.init({ visualObj: tune })
      const { duration } = await next.prime()
      synth.current = next
      synthAbc.current = abc
      durationMs.current = duration * 1000
      msPerStep.current = tune.millisecondsPerMeasure() / barSteps
    }

    const from = position * msPerStep.current
    if (from >= durationMs.current) return // playhead is past the end; press reset
    synth.current!.seek(from / 1000, 'seconds')
    synth.current!.start()
    setStatus('playing')

    const startedAt = performance.now() - from
    const tick = () => {
      const elapsed = performance.now() - startedAt
      if (elapsed >= durationMs.current) {
        // Reached the end: back to the start, like a DAW without loop.
        stopAudio()
        setStatus('stopped')
        setPosition(0)
        return
      }
      setPosition(elapsed / msPerStep.current)
      frame.current = requestAnimationFrame(tick)
    }
    tick()
  }

  function stop() {
    stopAudio()
    setStatus('stopped')
  }

  function reset() {
    stop()
    setPosition(0)
  }

  return { status, position, play, stop, reset }
}
