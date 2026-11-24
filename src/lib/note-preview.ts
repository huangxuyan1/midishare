/**
 * Plays one short note. The piano roll uses it when a note is pressed, and on
 * every pitch change while a note is dragged.
 *
 * The note is a one-note ABC clip played by the same abcjs synth as the
 * transport, so it has the same piano sound. Only one preview sounds at a
 * time: starting a new one stops the one before it.
 */
import abcjs from 'abcjs'
import { notesToAbcBody } from './abc-notes'

const PREVIEW_STEPS = 2 // an eighth note: a quarter of a second at 120 BPM

/** A one-note clip: the given MIDI pitch at the start of a bar. */
export function previewAbc(pitch: number): string {
  const body = notesToAbcBody([{ pitch, start: 0, length: PREVIEW_STEPS }], '4/4', '1/8', 'C')
  return `X:1\nM:4/4\nL:1/8\nQ:1/4=120\nK:C\n${body}`
}

let sounding: abcjs.MidiBuffer | null = null
let latest = 0 // counts the requests, so a slow one can tell that a newer one replaced it

export function stopPreview() {
  latest++ // also cancels a preview that is still loading
  sounding?.stop()
  sounding = null
}

export async function playPreview(pitch: number) {
  stopPreview()
  const request = latest
  if (!abcjs.synth.supportsAudio()) return

  try {
    const [tune] = abcjs.parseOnly(previewAbc(pitch))
    const synth = new abcjs.synth.CreateSynth()
    // Loads the piano sample for this pitch (abcjs caches it), then renders the audio.
    await synth.init({ visualObj: tune })
    await synth.prime()
    if (request !== latest) return // a newer preview, or a stop, came in while this one was loading
    synth.start()
    sounding = synth
  } catch {
    // A preview is a convenience: if the sample can't be loaded, stay silent.
  }
}
