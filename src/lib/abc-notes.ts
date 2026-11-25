/**
 * Converts between ABC text and a list of piano-roll notes.
 *
 * - ABC -> notes uses abcjs's own audio setup, so the roll shows exactly what
 *   you hear: key signatures and ties resolved, chord symbols ("Dm") expanded
 *   into real notes.
 * - notes -> ABC writes the music lines. Notes with the same start and length
 *   become one chord. Chords that overlap go into separate voices (V:1, V:2,
 *   ...), so inside a voice nothing overlaps. A chord that crosses a bar line,
 *   or whose length isn't one written note value, is split and tied (-).
 *   That is lossy for things like triplets, which get snapped to the grid,
 *   but every note keeps its pitch, start and length.
 *
 *   Why voices: abcjs only follows a tie inside a chord into a next chord
 *   that has the tied note in the same position, so "[CE-] E" plays the E
 *   twice. Tying whole chords to identical chords works inside one line of
 *   text. Two more abcjs habits shape the writer:
 *   - It remembers only one tied chord at a time, across all voices. A chord
 *     tied over a line break loses its tie when another voice has a tied chord
 *     in between. So a note that crosses a line break is written on its own,
 *     never in a chord.
 *   - It plays a tied note as one long note and skips the pieces after the
 *     first. An accidental written on such a piece (the "^F" after a tie over
 *     a bar line) does not count for the rest of that bar, so the next F#
 *     in the bar gets its own "^".
 *
 * Times are in grid steps of a 16th note.
 */
import abcjs from 'abcjs'
import { readHeaders } from './abc-headers'

export type Note = {
  /** MIDI pitch, 60 = middle C. */
  pitch: number
  /** Start, in 16th notes from the beginning. */
  start: number
  /** Length, in 16th notes. At least 1. */
  length: number
}

export const STEPS_PER_WHOLE = 16

// ---------------------------------------------------------------------------
// ABC -> notes
// ---------------------------------------------------------------------------

export function abcToNotes(abc: string): Note[] {
  const [tune] = abcjs.parseOnly(abc)
  if (!tune) return []
  const audio = setUpAudio(tune)
  const notes: Note[] = []
  for (const track of audio.tracks) {
    for (const event of track) {
      if (event.cmd !== 'note') continue
      notes.push({
        pitch: event.pitch,
        start: Math.round(event.start * STEPS_PER_WHOLE),
        length: Math.max(1, Math.round(event.duration * STEPS_PER_WHOLE)),
      })
    }
  }
  return sortNotes(dedupe(notes))
}

/**
 * How long the music is, in 16th notes, as abcjs counts it. Rests at the end
 * are part of the music, so this can be later than the end of the last note.
 */
export function abcLengthInSteps(abc: string): number {
  const [tune] = abcjs.parseOnly(abc)
  if (!tune) return 0
  return setUpAudio(tune).totalDuration * STEPS_PER_WHOLE
}

/** Times and lengths are in whole notes. */
type AudioSetup = {
  tracks: { cmd: string; pitch: number; start: number; duration: number }[][]
  totalDuration: number
}

/** abcjs's own list of what the tune plays. */
function setUpAudio(tune: abcjs.TuneObject): AudioSetup {
  // The type definitions give setUpAudio a different shape from what it returns here.
  return (tune as unknown as { setUpAudio: (options: object) => AudioSetup }).setUpAudio({})
}

/** Two notes on the same pitch at the same time can't be shown apart; keep the longer one. */
export function dedupe(notes: Note[]): Note[] {
  const byKey = new Map<string, Note>()
  for (const n of notes) {
    const key = `${n.pitch}@${n.start}`
    const existing = byKey.get(key)
    if (!existing || n.length > existing.length) byKey.set(key, n)
  }
  return [...byKey.values()]
}

export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => a.start - b.start || a.pitch - b.pitch)
}

// ---------------------------------------------------------------------------
// notes -> ABC
// ---------------------------------------------------------------------------

/** Replaces everything after the K: line with music written from `notes`. */
export function writeNotesIntoAbc(abc: string, notes: Note[]): string {
  const lines = abc.split('\n')
  const kIndex = lines.findIndex((line) => /^K:/.test(line))
  const headerLines = kIndex === -1 ? [...lines.filter((l) => /^[A-Za-z]:/.test(l)), 'K:C'] : lines.slice(0, kIndex + 1)
  const headers = readHeaders(headerLines.join('\n'))
  return [...headerLines, notesToAbcBody(notes, headers.meter, headers.unitLength, headers.key)].join('\n')
}

/** Notes that start together and have the same length: written as one chord. */
type Chord = { start: number; length: number; pitches: number[] }

const BARS_PER_LINE = 4

export function notesToAbcBody(notes: Note[], meter: string, unitLength: string, key: string): string {
  const barSteps = barLengthInSteps(meter)
  const end = Math.max(barSteps, ...notes.map((n) => n.start + n.length))
  const barCount = Math.ceil(end / barSteps)

  const voices = splitIntoVoices(notes, BARS_PER_LINE * barSteps)
  const voiceBars = voices.map((chords) => writeVoice(chords, barCount, barSteps, unitLength, key))

  // Four bars per line; the last bar line is the end mark |].
  const lines: string[] = []
  for (let first = 0; first < barCount; first += BARS_PER_LINE) {
    const ending = first + BARS_PER_LINE >= barCount ? ' |]' : ' |'
    voiceBars.forEach((bars, v) => {
      if (voices.length > 1) lines.push(voiceLine(v, voices[v], first === 0))
      lines.push(bars.slice(first, first + BARS_PER_LINE).join(' | ') + ending)
    })
  }
  return lines.join('\n')
}

/** "V:2 clef=bass" the first time a low voice appears, "V:2" after that. */
function voiceLine(index: number, chords: Chord[], first: boolean): string {
  const pitches = chords.flatMap((c) => c.pitches)
  const average = pitches.reduce((sum, p) => sum + p, 0) / pitches.length
  return `V:${index + 1}` + (first && average < 60 ? ' clef=bass' : '')
}

/**
 * Groups notes into chords, then hands each chord to the first voice that is
 * free at that moment. Higher chords choose first, so the top line tends to
 * stay in V:1. Always returns at least one voice.
 *
 * `lineSteps` is the length of one line of text. A note that sounds across the
 * end of a line stays out of chords (see the note on abcjs at the top).
 */
function splitIntoVoices(notes: Note[], lineSteps: number): Chord[][] {
  const byTime = new Map<string, Chord>()
  for (const n of notes) {
    const lastStep = n.start + n.length - 1
    const crossesLine = Math.floor(n.start / lineSteps) !== Math.floor(lastStep / lineSteps)
    const key = crossesLine ? `${n.start}+${n.length}+${n.pitch}` : `${n.start}+${n.length}`
    const chord = byTime.get(key) ?? { start: n.start, length: n.length, pitches: [] }
    chord.pitches.push(n.pitch)
    byTime.set(key, chord)
  }
  const top = (c: Chord) => Math.max(...c.pitches)
  const chords = [...byTime.values()]
    .map((c) => ({ ...c, pitches: [...c.pitches].sort((a, b) => a - b) }))
    .sort((a, b) => a.start - b.start || top(b) - top(a)) // higher chords pick a voice first

  const voices: Chord[][] = []
  for (const chord of chords) {
    const voice = voices.find((v) => {
      const last = v[v.length - 1]
      return last.start + last.length <= chord.start
    })
    if (voice) voice.push(chord)
    else voices.push([chord])
  }
  return voices.length > 0 ? voices : [[]]
}

/** One voice (chords that never overlap) -> the text of each bar. */
function writeVoice(chords: Chord[], barCount: number, barSteps: number, unitLength: string, key: string): string[] {
  const unitSteps = unitLengthInSteps(unitLength)
  const keyAccidentals = keySignature(key)
  const preferFlats = Object.values(keyAccidentals).some((a) => a < 0)

  // Cut points: every chord start and end, and every bar line.
  const cuts = new Set<number>()
  for (let bar = 0; bar <= barCount; bar++) cuts.add(bar * barSteps)
  for (const c of chords) {
    cuts.add(c.start)
    cuts.add(c.start + c.length)
  }
  const times = [...cuts].sort((a, b) => a - b)

  const bars: string[] = []
  let current: string[] = []
  // Accidentals written earlier in the bar, keyed by letter + octave ("F4").
  let barAccidentals: Record<string, number> = {}

  for (let i = 0; i < times.length - 1; i++) {
    const chord = chords.find((c) => c.start <= times[i] && c.start + c.length > times[i])

    // A piece of e.g. 5 sixteenths isn't one written note value, so split it
    // into ones that are (4 + 1) and tie the chord across the split.
    let from = times[i]
    for (const steps of splitIntoNoteValues(times[i + 1] - from)) {
      const to = from + steps
      const length = lengthText(steps, unitSteps)
      if (!chord) {
        current.push(`z${length}`)
      } else {
        const tie = chord.start + chord.length > to ? '-' : '' // keeps sounding after this piece
        // A later piece of a tied chord: abcjs ignores its accidentals, so write
        // them for the reader but don't count them for the rest of the bar.
        const accidentals = from > chord.start ? { ...barAccidentals } : barAccidentals
        const names = chord.pitches.map((p) => pitchText(p, keyAccidentals, accidentals, preferFlats))
        if (names.length === 1) current.push(names[0] + length + tie) // e.g. c2-
        else current.push(`[${names.map((name) => name + tie).join('')}]${length}`) // e.g. [D-F-A-]2
      }
      from = to
    }

    if (times[i + 1] % barSteps === 0) {
      bars.push(current.join(' '))
      current = []
      barAccidentals = {}
    }
  }
  return bars
}

// ---------------------------------------------------------------------------
// Pitch spelling
// ---------------------------------------------------------------------------

const SHARP_NAMES = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B']
const SHARP_ACC = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0]
const FLAT_NAMES = ['C', 'D', 'D', 'E', 'E', 'F', 'G', 'G', 'A', 'A', 'B', 'B']
const FLAT_ACC = [0, -1, 0, -1, 0, 0, -1, 0, -1, 0, -1, 0]

/**
 * MIDI pitch -> ABC note, e.g. 60 -> "C", 61 -> "^C", 72 -> "c", 48 -> "C,".
 * Writes an accidental only when the key signature (or an earlier accidental
 * in the same bar) doesn't already give the right pitch.
 */
function pitchText(
  pitch: number,
  keyAccidentals: Record<string, number>,
  barAccidentals: Record<string, number>,
  preferFlats: boolean,
): string {
  const pc = pitch % 12
  // Flat keys spell black keys as flats (Bb), other keys as sharps (A#).
  const letter = preferFlats ? FLAT_NAMES[pc] : SHARP_NAMES[pc]
  const accidental = preferFlats ? FLAT_ACC[pc] : SHARP_ACC[pc]

  // ABC octaves: C (MIDI 60) .. B, then c .. b one octave up.
  const octave = Math.floor(pitch / 12) - 1
  const barKey = letter + octave
  const inEffect = barAccidentals[barKey] ?? keyAccidentals[letter] ?? 0
  let prefix = ''
  if (accidental !== inEffect) {
    prefix = accidental === 1 ? '^' : accidental === -1 ? '_' : '='
    barAccidentals[barKey] = accidental
  }

  let name = octave >= 5 ? letter.toLowerCase() : letter
  if (octave > 5) name += "'".repeat(octave - 5)
  if (octave < 4) name += ','.repeat(4 - octave)
  return prefix + name
}

// ---------------------------------------------------------------------------
// Headers -> numbers
// ---------------------------------------------------------------------------

/** "4/4" -> 16, "3/4" -> 12, "6/8" -> 12, "C" -> 16, "C|" -> 16. */
export function barLengthInSteps(meter: string): number {
  if (meter === 'C' || meter === 'C|') return STEPS_PER_WHOLE
  const match = /^(\d+)\/(\d+)$/.exec(meter.trim())
  if (!match) return STEPS_PER_WHOLE
  return (STEPS_PER_WHOLE * Number(match[1])) / Number(match[2])
}

/** "1/8" -> 2 steps, "1/4" -> 4 steps, "1/16" -> 1 step. */
function unitLengthInSteps(unitLength: string): number {
  const match = /^(\d+)\/(\d+)$/.exec(unitLength.trim())
  if (!match) return 2
  return (STEPS_PER_WHOLE * Number(match[1])) / Number(match[2])
}

// Lengths (in 16ths) that one written note can have: 16th, 8th, dotted 8th,
// quarter, dotted quarter, half, dotted half, whole.
const NOTE_VALUES = [16, 12, 8, 6, 4, 3, 2, 1]

/** 5 -> [4, 1], 7 -> [6, 1], 9 -> [8, 1], 4 -> [4]. Largest first. */
function splitIntoNoteValues(steps: number): number[] {
  const result: number[] = []
  let left = steps
  while (left > 0) {
    const value = NOTE_VALUES.find((v) => v <= left)!
    result.push(value)
    left -= value
  }
  return result
}

/** Length in steps -> ABC length suffix relative to L:. With L:1/8, 2 -> "", 4 -> "2", 1 -> "/2", 3 -> "3/2". */
function lengthText(steps: number, unitSteps: number): string {
  // steps / unitSteps as a reduced fraction.
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  const d = gcd(steps, unitSteps)
  const num = steps / d
  const den = unitSteps / d
  if (den === 1) return num === 1 ? '' : String(num)
  return `${num === 1 ? '' : num}/${den}`
}

// Number of sharps (positive) or flats (negative) for each major key.
const MAJOR_FIFTHS: Record<string, number> = {
  C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7,
  F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7,
}
// How far each mode's signature is from the major key on the same tonic.
const MODE_SHIFT: Record<string, number> = {
  '': 0, maj: 0, ion: 0, m: -3, min: -3, aeo: -3, dor: -2, phr: -4, lyd: 1, mix: -1, loc: -5,
}

/** "D" -> { F: 1, C: 1 }, "Dm" -> { B: -1 }, "Bb" -> { B: -1, E: -1 }. */
export function keySignature(key: string): Record<string, number> {
  const match = /^([A-G])([#b]?)\s*([A-Za-z]*)/.exec(key.trim())
  if (!match) return {}
  const tonic = match[1] + match[2]
  const mode = match[3].toLowerCase().slice(0, 3)
  const fifths = (MAJOR_FIFTHS[tonic] ?? 0) + (MODE_SHIFT[mode] ?? 0)
  const result: Record<string, number> = {}
  if (fifths > 0) for (const l of 'FCGDAEB'.slice(0, fifths)) result[l] = 1
  if (fifths < 0) for (const l of 'BEADGCF'.slice(0, -fifths)) result[l] = -1
  return result
}
