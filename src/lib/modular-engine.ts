/**
 * The audio engine that uses Modular, Xuyan's audio graph runtime, compiled
 * to WebAssembly and playing a soundfont.
 *
 * How it works: the clip goes to Modular as the MIDI bytes that Download .mid
 * produces, with one change: each note's velocity is rewritten so the accents
 * sound as they do in the abcjs synth (see midi-velocity.ts). Modular sends
 * back the left and right channels as two arrays of samples. We make them
 * louder (see GAIN) and copy them into an AudioBuffer.
 *
 * The buffer holds the notes and then the last ones dying away, for at most
 * two seconds. Rests at the end of the clip are not in it; the transport
 * (use-playback.ts) keeps the clip's own length.
 *
 * The instrument comes from a function passed in (`loadPiano` in
 * modular-piano.ts on the site), so the tests can pass a fake one.
 */
import type { Instrument } from '../modular/modular.mjs'
import { abcToMidi } from './abc'
import type { AudioEngine } from './audio-engine'
import { withSoundfontVelocities } from './midi-velocity'

/**
 * Modular sends the piano's samples as they are, and leaves the level to the
 * page. Measured on the same clips, with the velocities rewritten, they are
 * about 3 times quieter than the abcjs synth, so this brings the two engines
 * to about the same loudness. PROVISIONAL: Xuyan sets the final value by ear.
 */
export const GAIN = 3

/**
 * Makes the engine. `loadInstrument` loads the Modular module and the
 * soundfont. It is called on the first render and the instrument is kept for
 * the life of the page. If loading fails, the next render tries again.
 */
export function modularEngine(loadInstrument: () => Promise<Instrument>): AudioEngine {
  let instrument: Promise<Instrument> | null = null

  return {
    async render(abc, context) {
      instrument ??= loadInstrument().catch((error) => {
        instrument = null // forget the failed load, so the next render starts a new one
        throw error
      })
      const piano = await instrument
      const midi = withSoundfontVelocities(abcToMidi(abc))
      const { sampleRate, channels } = await piano.render(midi, context.sampleRate)
      const [left, right] = channels
      if (left.length === 0) return null // nothing to play

      const buffer = context.createBuffer(2, left.length, sampleRate)
      buffer.copyToChannel(left.map((sample) => sample * GAIN), 0)
      buffer.copyToChannel(right.map((sample) => sample * GAIN), 1)
      return buffer
    },
  }
}
