/**
 * The audio engine that uses Modular, Xuyan's audio graph runtime, compiled
 * to WebAssembly and playing a soundfont.
 *
 * NOT IN USE YET. `engine` in audio-engine.ts still points at abcjs.
 *
 * How it works: the clip goes to Modular as the same MIDI bytes that
 * Download .mid produces. Modular sends back the left and right channels as
 * two arrays of samples, and we copy them into an AudioBuffer.
 *
 * The instrument comes from a function passed in (`loadPiano` in
 * modular-piano.ts on the site), so the tests can pass a fake one.
 */
import type { Instrument } from '../modular/modular.mjs'
import { abcToMidi } from './abc'
import type { AudioEngine } from './audio-engine'

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
      const { sampleRate, channels } = await piano.render(abcToMidi(abc), context.sampleRate)
      const [left, right] = channels
      if (left.length === 0) return null // nothing to play

      const buffer = context.createBuffer(2, left.length, sampleRate)
      buffer.copyToChannel(left, 0)
      buffer.copyToChannel(right, 1)
      return buffer
    },
  }
}
