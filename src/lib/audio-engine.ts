/**
 * The seam between the site and whatever makes its sound.
 *
 * An engine does one thing: it renders a whole clip, given as ABC text, into
 * one AudioBuffer. Playing that buffer is plain Web Audio and is the same for
 * every engine, so it lives here as well (audioContext, playBuffer).
 *
 * The transport (use-playback.ts) and the note preview (note-preview.ts) make
 * sound only through this file. There are two engines: Modular playing a
 * piano soundfont (modular-engine.ts), and the synth built into abcjs
 * (abcjs-engine.ts). `engine` below picks which one the site uses.
 */
import { abcjsEngine } from './abcjs-engine'
import { modularEngine } from './modular-engine'
import { loadPiano } from './modular-piano'

export type AudioEngine = {
  /** Renders the clip into a buffer for `context`. Null when the ABC has no music to play. */
  render(abc: string, context: AudioContext): Promise<AudioBuffer | null>
}

/**
 * An engine that renders with `main`, and with `backup` when `main` fails:
 * when Modular or the piano can't be downloaded, or Modular rejects the clip.
 */
export function withFallback(main: AudioEngine, backup: AudioEngine): AudioEngine {
  return {
    async render(abc, context) {
      try {
        return await main.render(abc, context)
      } catch (error) {
        console.warn('The Modular engine could not render this; using the abcjs synth.', error)
        return backup.render(abc, context)
      }
    },
  }
}

/**
 * The engine the site uses: Modular, with the abcjs synth as its backup.
 * To go back to abcjs alone, write `abcjsEngine` here.
 */
export const engine: AudioEngine = withFallback(modularEngine(loadPiano), abcjsEngine)

let context: AudioContext | null = null

/**
 * The page's one AudioContext, made on first use. Browsers let a page make
 * sound only after a click or a key press, so call this from one.
 * Null when the browser has no Web Audio.
 */
export function audioContext(): AudioContext | null {
  if (!context) {
    if (typeof AudioContext === 'undefined') return null
    context = new AudioContext()
  }
  if (context.state === 'suspended') void context.resume()
  return context
}

/** Starts the buffer at `offsetSeconds` and returns a function that stops it. */
export function playBuffer(context: AudioContext, buffer: AudioBuffer, offsetSeconds = 0): () => void {
  const source = context.createBufferSource()
  source.buffer = buffer
  source.connect(context.destination)
  source.start(0, offsetSeconds)
  return () => {
    source.stop()
    source.disconnect()
  }
}
