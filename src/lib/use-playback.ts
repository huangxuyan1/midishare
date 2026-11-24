/**
 * Plays ABC like a DAW transport:
 * - play starts from the playhead
 * - stop pauses and leaves the playhead where it is
 * - reset stops and moves the playhead back to the start
 * - seek moves the playhead while it is dragged; a playing clip goes quiet
 *   during the drag and carries on from where the playhead is dropped
 *
 * The sound is one buffer holding the whole clip, rendered by the audio
 * engine (see audio-engine.ts) the first time the clip is played after an
 * edit. Play, stop and seek only start and stop that buffer.
 *
 * `position` is the playhead in 16th-note steps (the piano roll's grid), updated
 * every animation frame while playing. It is computed from the clock, not read
 * from the audio, using the tune's own milliseconds-per-bar. The end of the
 * music is reached when the clock passes the buffer's length.
 */
import { useEffect, useRef, useState } from 'react'
import abcjs from 'abcjs'
import { audioContext, engine, playBuffer } from './audio-engine'

export type PlaybackStatus = 'stopped' | 'loading' | 'playing'

export function usePlayback(abc: string, barSteps: number) {
  const [status, setStatus] = useState<PlaybackStatus>('stopped')
  const [position, setPosition] = useState(0)

  const buffer = useRef<AudioBuffer | null>(null) // the rendered clip
  const bufferAbc = useRef<string | null>(null) // the ABC the buffer was rendered from
  const stopSound = useRef<(() => void) | null>(null) // stops the buffer while it plays
  const msPerStep = useRef(0)
  const frame = useRef(0)
  const resumeAfterSeek = useRef(false) // a drag of the playhead interrupted playback

  function stopAudio() {
    stopSound.current?.()
    stopSound.current = null
    cancelAnimationFrame(frame.current)
  }

  // Editing the music stops playback; the next play renders the audio again.
  // Leaving the page stops it too.
  useEffect(() => {
    return () => {
      stopAudio()
      setStatus('stopped')
    }
  }, [abc])

  /** Renders the audio if the music changed, then plays from the given step. */
  async function playFrom(step: number) {
    const [tune] = abcjs.parseOnly(abc)
    const context = audioContext()
    if (!tune || !context) return

    if (bufferAbc.current !== abc) {
      setStatus('loading')
      buffer.current = await engine.render(abc, context)
      bufferAbc.current = abc
      msPerStep.current = tune.millisecondsPerMeasure() / barSteps
    }
    if (!buffer.current) {
      setStatus('stopped') // the ABC has no notes: nothing to play
      return
    }

    const durationMs = buffer.current.duration * 1000
    let from = step * msPerStep.current
    if (from >= durationMs) from = 0 // the playhead is past the end of the music: start over
    stopAudio() // never two at once
    stopSound.current = playBuffer(context, buffer.current, from / 1000)
    setStatus('playing')

    const startedAt = performance.now() - from
    const tick = () => {
      const elapsed = performance.now() - startedAt
      if (elapsed >= durationMs) {
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

  function play() {
    return playFrom(position)
  }

  function stop() {
    stopAudio()
    setStatus('stopped')
  }

  /** Called on every move while the playhead is dragged. */
  function seek(step: number) {
    if (status === 'loading') return // the audio is being rendered; it will start from the old place
    if (status === 'playing') {
      stop()
      resumeAfterSeek.current = true
    }
    setPosition(Math.max(0, step))
  }

  /** Called once when the playhead is dropped. */
  function endSeek(step: number) {
    if (!resumeAfterSeek.current) return
    resumeAfterSeek.current = false
    void playFrom(step)
  }

  function reset() {
    stop()
    setPosition(0)
  }

  return { status, position, play, stop, reset, seek, endSeek }
}
