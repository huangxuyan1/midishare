/**
 * Loads what the Modular audio engine needs: Modular itself, a WebAssembly
 * module built from Xuyan's Modular project (the files in src/modular), and
 * the piano soundfont. Together they make an instrument that renders MIDI.
 *
 * Used by the Modular engine, which audio-engine.ts switches on.
 */
import { loadModular, type Instrument } from '../modular/modular.mjs'
import { fetchPiano } from './piano-soundfont'

/** Downloads Modular and the piano at the same time, then makes the piano instrument. */
export async function loadPiano(): Promise<Instrument> {
  const [modular, soundfont] = await Promise.all([loadModular(), fetchPiano()])
  return modular.createInstrument(soundfont)
}
