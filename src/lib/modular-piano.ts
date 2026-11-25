/**
 * Loads what the Modular audio engine needs: Modular itself, a WebAssembly
 * module built from Xuyan's Modular project (the files in src/modular), and
 * the piano soundfont. Together they make an instrument that renders MIDI.
 *
 * Used by the Modular engine, which audio-engine.ts switches on.
 */
import { loadModular, type Instrument } from '../modular/modular.mjs'
import wasmUrl from '../modular/modular_web.wasm?url'
import { fetchPiano } from './piano-soundfont'

/** Downloads Modular and the piano at the same time, then makes the piano instrument. */
export async function loadPiano(): Promise<Instrument> {
  const [modular, soundfont] = await Promise.all([loadModularFromBytes(), fetchPiano()])
  return modular.createInstrument(soundfont)
}

/**
 * Downloads the .wasm file here and hands Modular a copy labelled
 * "application/wasm".
 *
 * Why: a browser compiles WebAssembly while it downloads only when the file
 * arrives with that type. The host serves it as "application/octet-stream"
 * (plain bytes). Left alone, Modular's loader still works, but only after a
 * failed first try that writes two errors to the console.
 */
async function loadModularFromBytes() {
  const response = await fetch(wasmUrl)
  if (!response.ok) throw new Error(`Modular could not be downloaded (status ${response.status}).`)
  const labelled = new Blob([await response.arrayBuffer()], { type: 'application/wasm' })
  const address = URL.createObjectURL(labelled) // a "blob:" address for the copy in memory
  try {
    // locateFile tells the loader where to fetch its .wasm from.
    return await loadModular({ locateFile: () => address })
  } finally {
    URL.revokeObjectURL(address)
  }
}
