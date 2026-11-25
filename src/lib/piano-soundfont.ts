/**
 * The default piano for the Modular audio engine: a SoundFont file holding
 * the "Yamaha Grand Piano" of FluidR3_GM (MIT licence). The file, its licence
 * notice and a note on where it came from are in src/assets/piano.
 *
 * Used by the Modular engine, which audio-engine.ts switches on.
 */

// `?url` makes Vite copy the file into the build under a name that carries a
// hash of its contents, and gives us that address. A changed file gets a new
// address, so a browser never plays an old copy.
import pianoUrl from '../assets/piano/fluidr3-gm-0-0-yamaha-grand-piano.sf2?url'

/** Downloads the piano (about 7.5 MB) from the site's own files. */
export async function fetchPiano(): Promise<Uint8Array> {
  const response = await fetch(pianoUrl)
  if (!response.ok) throw new Error(`The piano soundfont could not be downloaded (status ${response.status}).`)
  return new Uint8Array(await response.arrayBuffer())
}
