/**
 * The audio engine that uses Modular, Xuyan's audio graph runtime, compiled
 * to WebAssembly and playing a soundfont.
 *
 * NOT IN USE YET. `engine` in audio-engine.ts still points at abcjs, and the
 * Modular web build does not exist yet. This file is written against the
 * contract agreed with the Modular project, so it can be tested with a fake
 * instrument until the real one arrives.
 *
 * How it works: the clip goes to Modular as the same MIDI bytes that
 * Download .mid produces. Modular sends back the left and right channels as
 * two arrays of samples, and we copy them into an AudioBuffer.
 */
import { abcToMidi } from './abc'
import type { AudioEngine } from './audio-engine'

/** Samples between -1 and 1, in memory that JavaScript owns (not WebAssembly's). */
type Samples = Float32Array<ArrayBuffer>

/** What Modular's web build gives the page: an instrument that renders MIDI. */
export type ModularInstrument = {
  /** Renders a Standard MIDI File at the given rate. Rejects with Modular's error message. */
  render(midi: Uint8Array, sampleRate: number): Promise<{ sampleRate: number; channels: [Samples, Samples] }>
}

/**
 * Makes the engine. `loadInstrument` loads the Modular module and the
 * soundfont; it is called once, on the first render, and the instrument is
 * kept for the life of the page.
 */
export function modularEngine(loadInstrument: () => Promise<ModularInstrument>): AudioEngine {
  let instrument: Promise<ModularInstrument> | null = null

  return {
    async render(abc, context) {
      instrument ??= loadInstrument()
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
