/**
 * Converts between ABC text and a list of piano-roll notes.
 *
 * - ABC -> notes uses abcjs's own audio setup, so the roll shows exactly what
 *   you hear: key signatures and ties resolved, chord symbols ("Dm") expanded
 *   into real notes.
 * - notes -> ABC writes the music lines for a single voice. The timeline is
 *   cut at every note start/end and every bar line; each piece becomes a
 *   chord (or a rest), and a note that continues into the next piece gets a
 *   tie (-). That is lossy for things like triplets, which get snapped to the
 *   grid, but every note keeps its pitch, start and length.
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
  // setUpAudio isn't in abcjs's type definitions, but it is on every parsed tune.
  const audio = (tune as unknown as { setUpAudio: (o: object) => AudioSetup }).setUpAudio({})
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

type AudioSetup = { tracks: { cmd: string; pitch: number; start: number; duration: number }[][] }

/** Two notes on the same pitch at the same time can't be shown apart; keep the longer one. */
function dedupe(notes: Note[]): Note[] {
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

export function notesToAbcBody(notes: Note[], meter: string, unitLength: string, key: string): string {
  const barSteps = barLengthInSteps(meter)
  const unitSteps = unitLengthInSteps(unitLength)
  const keyAccidentals = keySignature(key)
  const preferFlats = Object.values(keyAccidentals).some((a) => a < 0)

  const end = Math.max(barSteps, ...notes.map((n) => n.start + n.length))
  const barCount = Math.ceil(end / barSteps)

  // Cut points: every note start and end, and every bar line.
  const cuts = new Set<number>()
  for (let bar = 0; bar <= barCount; bar++) cuts.add(bar * barSteps)
  for (const n of notes) {
    cuts.add(n.start)
    cuts.add(n.start + n.length)
  }
  const times = [...cuts].filter((t) => t <= barCount * barSteps).sort((a, b) => a - b)

  const bars: string[] = []
  let current: string[] = []
  // Accidentals written earlier in the bar, keyed by letter + octave ("F4").
  let barAccidentals: Record<string, number> = {}

  for (let i = 0; i < times.length - 1; i++) {
    const sounding = notes
      .filter((n) => n.start <= times[i] && n.start + n.length > times[i])
      .sort((a, b) => a.pitch - b.pitch)

    // A piece of e.g. 5 sixteenths isn't one written note value, so split it
    // into ones that are (4 + 1) and tie the notes across the split.
    let from = times[i]
    for (const steps of splitIntoNoteValues(times[i + 1] - from)) {
      const to = from + steps
      const length = lengthText(steps, unitSteps)
      if (sounding.length === 0) {
        current.push(`z${length}`)
      } else {
        const parts = sounding.map((n) => {
          const name = pitchText(n.pitch, keyAccidentals, barAccidentals, preferFlats)
          const tie = n.start + n.length > to ? '-' : '' // keeps sounding after this piece
          return { name, tie }
        })
        if (parts.length === 1) {
          current.push(parts[0].name + length + parts[0].tie) // e.g. c2-
        } else {
          current.push(`[${parts.map((p) => p.name + p.tie).join('')}]${length}`) // e.g. [D-FA]2
        }
      }
      from = to
    }

    const to = times[i + 1]
    if (to % barSteps === 0) {
      bars.push(current.join(' '))
      current = []
      barAccidentals = {}
    }
  }

  // Four bars per line; the last bar line is the end mark |].
  const lines: string[] = []
  for (let i = 0; i < bars.length; i += 4) {
    const isLast = i + 4 >= bars.length
    lines.push(bars.slice(i, i + 4).join(' | ') + (isLast ? ' |]' : ' |'))
  }
  return lines.join('\n')
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
