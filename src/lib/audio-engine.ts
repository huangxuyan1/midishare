/**
 * The seam between the site and whatever makes its sound.
 *
 * An engine does one thing: it renders a whole clip, given as ABC text, into
 * one AudioBuffer. Playing that buffer is plain Web Audio and is the same for
 * every engine, so it lives here as well (audioContext, playBuffer).
 *
 * The transport (use-playback.ts) and the note preview (note-preview.ts) make
 * sound only through this file. Today there is one engine, the synth built
 * into abcjs (abcjs-engine.ts). To use another engine, write a file like that
 * one and change `engine` below.
 */
import { abcjsEngine } from './abcjs-engine'

export type AudioEngine = {
  /** Renders the clip into a buffer for `context`. Null when the ABC has no music to play. */
  render(abc: string, context: AudioContext): Promise<AudioBuffer | null>
}

/** The engine the site uses. */
export const engine: AudioEngine = abcjsEngine

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
