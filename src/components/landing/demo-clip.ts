/**
 * The clip shown on the landing page, as ABC text and as the notes that text
 * stands for. The landing page is static, so the notes are written out here
 * instead of being parsed in the browser. demo-clip.test.ts checks that they
 * are what abcToNotes makes of the ABC.
 */
import type { Note } from '@/lib/abc-notes'

export const DEMO_TITLE = 'Night loop'
export const DEMO_KEY = 'Dm'
export const DEMO_METER = '4/4'
export const DEMO_TEMPO = 90
export const DEMO_BAR_STEPS = 16 // 4/4 in 16th notes

export const DEMO_ABC = `X:1
T:${DEMO_TITLE}
M:${DEMO_METER}
L:1/8
Q:1/4=${DEMO_TEMPO}
K:${DEMO_KEY}
D2 F A d2 c A | G2 B d g2 f d |]`

/** start and length in 16th notes; pitch as a MIDI number (60 = middle C). */
export const DEMO_NOTES: Note[] = [
  { pitch: 62, start: 0, length: 4 }, // D
  { pitch: 65, start: 4, length: 2 }, // F
  { pitch: 69, start: 6, length: 2 }, // A
  { pitch: 74, start: 8, length: 4 }, // d
  { pitch: 72, start: 12, length: 2 }, // c
  { pitch: 69, start: 14, length: 2 }, // A
  { pitch: 67, start: 16, length: 4 }, // G
  { pitch: 70, start: 20, length: 2 }, // B flat (from the key)
  { pitch: 74, start: 22, length: 2 }, // d
  { pitch: 79, start: 24, length: 4 }, // g
  { pitch: 77, start: 28, length: 2 }, // f
  { pitch: 74, start: 30, length: 2 }, // d
]

/** One pass of the playhead at the clip's real speed: 2 bars = 8 beats at 90 BPM. */
const DEMO_BARS = 2
export const DEMO_SECONDS = ((DEMO_BARS * DEMO_BAR_STEPS) / 4) * (60 / DEMO_TEMPO)
