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
 * music, and it reports no warnings.
 */
export function checkAbc(abc: string): AbcCheck {
  if (abc.trim() === '') return { ok: false, errors: ['The ABC is empty.'] }
  if (!/^K:/m.test(abc)) return { ok: false, errors: ['ABC needs a K: (key) header line, e.g. K:C'] }
  try {
    const [tune] = abcjs.parseOnly(abc)
    if (!tune || tune.lines.length === 0) return { ok: false, errors: ['No music found after the headers.'] }
    // abcjs warnings contain HTML markup; keep them as plain text.
    const warnings = (tune.warnings ?? []).map((w) => w.replace(/<[^>]*>/g, ''))
    return warnings.length > 0 ? { ok: false, errors: warnings } : { ok: true }
  } catch (err) {
    return { ok: false, errors: [err instanceof Error ? err.message : String(err)] }
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
