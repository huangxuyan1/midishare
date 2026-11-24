/**
 * Small helpers around abcjs: check that ABC parses, download it as MIDI,
 * and split the comma-separated tags column.
 */
import abcjs from 'abcjs'

export const EXAMPLE_ABC = `X:1
T:Example
M:4/4
L:1/8
Q:1/4=90
K:Dm
"Dm"D2 F2 A2 d2 | "Bb"B,2 D2 F2 B2 | "C"C2 E2 G2 c2 | "A"A,2 ^C2 E2 A2 |]`

export type AbcCheck = { ok: true } | { ok: false; errors: string[] }

/**
 * abcjs is forgiving: it rarely throws, it skips what it can't read and adds
 * a warning ("hello" parses as the single note "e" plus four warnings).
 * So "valid" here is strict: there is a K: (key) header line, abcjs finds
 * music, it reports no warnings, and the voices are in step.
 *
 * One warning is allowed: "Duration not representable". The ABC standard
 * permits a length that isn't one written note value, such as z5 or F5 (five
 * eighths), and MIDI exports produce them. abcjs reads and plays the length
 * correctly; it only can't draw it as one symbol, so the sheet music shows
 * the nearest shape.
 */
const DRAWING_ONLY_WARNING = 'Duration not representable'

/**
 * The error for voices that abcjs would play out of step (see abc-voices.ts,
 * which can fix it). Exported so the editor can offer that fix.
 */
export const VOICES_OUT_OF_STEP =
  'The voices have different numbers of music lines. Voices are matched line by line, so the extra lines would play in the wrong voice. Give every voice the same number of lines.'

export function checkAbc(abc: string): AbcCheck {
  if (abc.trim() === '') return { ok: false, errors: ['The ABC is empty.'] }
  if (!/^K:/m.test(abc)) return { ok: false, errors: ['ABC needs a K: (key) header line, e.g. K:C'] }
  try {
    const [tune] = abcjs.parseOnly(abc)
    if (!tune || tune.lines.length === 0) return { ok: false, errors: ['No music found after the headers.'] }
    const warnings = (tune.warnings ?? [])
      .map((w) => w.replace(/<[^>]*>/g, '')) // abcjs warnings contain HTML markup; keep them as plain text
      .filter((w) => !w.includes(DRAWING_ONLY_WARNING))
    if (warnings.length > 0) return { ok: false, errors: warnings }
    if (!voicesInStep(tune)) return { ok: false, errors: [VOICES_OUT_OF_STEP] }
    return { ok: true }
  } catch (err) {
    return { ok: false, errors: [err instanceof Error ? err.message : String(err)] }
  }
}

/**
 * abcjs turns each line of music into one "system" and matches voices by
 * their position in it. The voices are in step when every system has the
 * same voices: "1+1" for two staffs with one voice each, on every line.
 */
function voicesInStep(tune: abcjs.TuneObject): boolean {
  const shapes = tune.lines
    .filter((line) => line.staff !== undefined) // skips subtitle and text lines
    .map((line) => line.staff!.map((staff) => staff.voices?.length ?? 0).join('+'))
  return new Set(shapes).size <= 1
}

/**
 * The clip as the bytes of a Standard MIDI File (.mid).
 * Download .mid and the Modular audio engine both get their bytes here, so
 * what a clip sounds like and what its download contains can't drift apart.
 */
export function abcToMidi(abc: string): Uint8Array<ArrayBuffer> {
  // 'binary' returns one Uint8Array per tune in the text; clips hold one tune.
  const [bytes] = abcjs.synth.getMidiFile(abc, { midiOutputType: 'binary' }) as Uint8Array<ArrayBuffer>[]
  return bytes
}

/** Turns ABC into a .mid file and starts a browser download. */
export function downloadMidi(abc: string, title: string) {
  const blob = new Blob([abcToMidi(abc)], { type: 'audio/midi' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${safeFileName(title)}.mid`
  link.click()
  URL.revokeObjectURL(url)
}

function safeFileName(title: string) {
  return title.trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-').toLowerCase() || 'clip'
}

/** "lofi, Chords ,,d minor" -> ["lofi", "chords", "d minor"] */
export function parseTags(tags: string): string[] {
  return tags
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t !== '')
}
