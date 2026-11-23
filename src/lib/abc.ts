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

export type AbcCheck = { ok: true; warnings: string[] } | { ok: false; error: string }

/**
 * abcjs is forgiving: it rarely throws, it just skips what it can't read.
 * So "valid" here means: it produced a tune with at least one line of music.
 * Parser warnings are returned so the UI can show them.
 */
export function checkAbc(abc: string): AbcCheck {
  if (abc.trim() === '') return { ok: false, error: 'The ABC is empty.' }
  try {
    const [tune] = abcjs.parseOnly(abc)
    if (!tune || tune.lines.length === 0) {
      return { ok: false, error: 'No music found. ABC needs a K: header line and some notes.' }
    }
    return { ok: true, warnings: tune.warnings ?? [] }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Turns ABC into a .mid file and starts a browser download. */
export function downloadMidi(abc: string, title: string) {
  // 'binary' returns one Uint8Array per tune in the text; clips hold one tune.
  const [bytes] = abcjs.synth.getMidiFile(abc, { midiOutputType: 'binary' }) as Uint8Array<ArrayBuffer>[]
  const blob = new Blob([bytes], { type: 'audio/midi' })
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
