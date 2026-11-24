/**
 * Plays one short note. The piano roll uses it when a note is pressed, and on
 * every pitch change while a note is dragged.
 *
 * The note is a one-note ABC clip rendered by the same audio engine as the
 * transport (see audio-engine.ts), so it has the same sound. Only one preview
 * sounds at a time: starting a new one stops the one before it.
 */
import { notesToAbcBody } from './abc-notes'
import { audioContext, engine, playBuffer } from './audio-engine'

const PREVIEW_STEPS = 2 // an eighth note: a quarter of a second at 120 BPM

/** A one-note clip: the given MIDI pitch at the start of a bar. */
export function previewAbc(pitch: number): string {
  const body = notesToAbcBody([{ pitch, start: 0, length: PREVIEW_STEPS }], '4/4', '1/8', 'C')
  return `X:1\nM:4/4\nL:1/8\nQ:1/4=120\nK:C\n${body}`
}

let stopSounding: (() => void) | null = null // stops the preview that is playing
let latest = 0 // counts the requests, so a slow one can tell that a newer one replaced it

export function stopPreview() {
  latest++ // also cancels a preview that is still being rendered
  stopSounding?.()
  stopSounding = null
}

export async function playPreview(pitch: number) {
  stopPreview()
  const request = latest
  const context = audioContext()
  if (!context) return

  try {
    const buffer = await engine.render(previewAbc(pitch), context)
    if (request !== latest || !buffer) return // a newer preview, or a stop, came in while this one was rendered
    stopSounding = playBuffer(context, buffer)
  } catch {
    // A preview is a convenience: if the note can't be rendered, stay silent.
  }
}
