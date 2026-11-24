/**
 * Reads a Standard MIDI File (.mid) and writes it as ABC.
 *
 * What is kept: the notes of every track, merged into one, plus the first
 * tempo and the first time signature.
 * What is lost: velocity, instruments, later tempo changes, and any timing
 * finer than a 16th note (starts and ends snap to the piano roll's grid).
 * The drum channel is skipped, because its "pitches" are drum sounds.
 *
 * File layout, for reading the code below:
 * - a header chunk "MThd": format, number of tracks, ticks per quarter note
 * - one "MTrk" chunk per track: a list of events, each with the time since the
 *   event before it (in ticks) and then the event itself
 * - numbers are big-endian; times and lengths inside a track are
 *   "variable-length": 7 bits per byte, and the top bit says "more bytes follow"
 */
import { barLengthInSteps, dedupe, notesToAbcBody, sortNotes, type Note } from './abc-notes'

const LOWEST = 36 // C2 and B6: the range of the piano roll
const HIGHEST = 95
const DRUM_CHANNEL = 9 // channel 10 when counting from 1

export type MidiContent = {
  /** On the 16th-note grid, like the piano roll's notes. */
  notes: Note[]
  /** Beats per minute. */
  tempo: number
  /** For example "4/4". */
  meter: string
}

/** Throws an Error with a message for the user when the file can't be read. */
export function readMidi(bytes: Uint8Array): MidiContent {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.length < 14 || chunkName(bytes, 0) !== 'MThd') throw new Error('This is not a MIDI file.')
  const trackCount = view.getUint16(10)
  const division = view.getUint16(12)
  if (division & 0x8000) throw new Error('This MIDI file uses SMPTE timing, which is not supported.')
  const ticksPerStep = division / 4 // division is ticks per quarter note; a step is a 16th

  const content: MidiContent = { notes: [], tempo: 120, meter: '4/4' }
  const seen = { tempo: false, meter: false } // only the first tempo and meter count
  let at = 8 + view.getUint32(4) // the first chunk after the header
  for (let t = 0; t < trackCount && at + 8 <= bytes.length; t++) {
    const length = view.getUint32(at + 4)
    if (chunkName(bytes, at) === 'MTrk') {
      readTrack(bytes.subarray(at + 8, at + 8 + length), ticksPerStep, content, seen)
    }
    at += 8 + length
  }

  content.notes = sortNotes(dedupe(content.notes))
  return content
}

function chunkName(bytes: Uint8Array, at: number): string {
  return String.fromCharCode(...bytes.subarray(at, at + 4))
}

/** Adds one track's notes to `content`, and its tempo and meter if none was seen yet. */
function readTrack(
  track: Uint8Array,
  ticksPerStep: number,
  content: MidiContent,
  seen: { tempo: boolean; meter: boolean },
) {
  let pos = 0
  let tick = 0 // time since the start of the track
  let status = 0 // the current event type; an event may leave it out to repeat the last one
  const sounding = new Map<number, number>() // channel and pitch -> the tick the note began

  function readVariableLength(): number {
    let value = 0
    let byte: number
    do {
      byte = track[pos++]
      value = value * 128 + (byte & 0x7f)
    } while (byte & 0x80 && pos < track.length)
    return value
  }

  while (pos < track.length) {
    tick += readVariableLength()
    if (track[pos] & 0x80) status = track[pos++] // a data byte here means "same type as the last event"

    // Meta events (FF): type, length, data. Tempo and time signature are the two that matter.
    if (status === 0xff) {
      const type = track[pos++]
      const length = readVariableLength()
      const data = track.subarray(pos, pos + length)
      pos += length
      if (type === 0x51 && length === 3 && !seen.tempo) {
        const microsecondsPerQuarter = data[0] * 65536 + data[1] * 256 + data[2]
        content.tempo = clamp(Math.round(60_000_000 / microsecondsPerQuarter), 20, 300)
        seen.tempo = true
      }
      if (type === 0x58 && length >= 2 && !seen.meter) {
        const meter = `${data[0]}/${2 ** data[1]}` // the denominator is stored as a power of two
        if (Number.isInteger(barLengthInSteps(meter)) && barLengthInSteps(meter) > 0) content.meter = meter
        seen.meter = true
      }
      continue
    }
    // System-exclusive events (F0, F7): length, data. Skipped.
    if (status === 0xf0 || status === 0xf7) {
      const length = readVariableLength()
      pos += length
      continue
    }

    // Channel events: the high half of the status is the type, the low half the channel.
    const type = status & 0xf0
    const channel = status & 0x0f
    const pitch = track[pos++]
    const hasSecondByte = type !== 0xc0 && type !== 0xd0 // program change and channel pressure have one
    const velocity = hasSecondByte ? track[pos++] : 0
    if (channel === DRUM_CHANNEL) continue

    const key = channel * 128 + pitch
    if (type === 0x90 && velocity > 0) {
      if (!sounding.has(key)) sounding.set(key, tick)
    } else if (type === 0x80 || type === 0x90) {
      // Note off. A note-on with velocity 0 means the same.
      const began = sounding.get(key)
      if (began === undefined) continue
      sounding.delete(key)
      const start = Math.round(began / ticksPerStep)
      const length = Math.max(1, Math.round(tick / ticksPerStep) - start)
      content.notes.push({ pitch: intoRollRange(pitch), start, length })
    }
  }
}

/** Notes below C2 or above B6 move by octaves until they fit on the piano roll. */
function intoRollRange(pitch: number): number {
  while (pitch < LOWEST) pitch += 12
  while (pitch > HIGHEST) pitch -= 12
  return pitch
}

function clamp(value: number, low: number, high: number) {
  return Math.min(high, Math.max(low, value))
}

export type MidiImport = {
  abc: string
  /** How many bars of the file are in the ABC. */
  bars: number
  /** How many bars the file has. More than `bars` when the file was too long for one clip. */
  totalBars: number
}

/**
 * The file as an ABC clip of at most `maxLength` characters. A file that is
 * too long is cut at a bar line: it keeps as many bars from the start as fit.
 */
export function midiToAbc(bytes: Uint8Array, title: string, maxLength: number): MidiImport {
  const { notes, tempo, meter } = readMidi(bytes)
  if (notes.length === 0) throw new Error('No notes were found in this MIDI file.')

  // Empty bars before the first note are dropped.
  const barSteps = barLengthInSteps(meter)
  const lead = Math.floor(notes[0].start / barSteps) * barSteps
  const shifted = notes.map((n) => ({ ...n, start: n.start - lead }))
  const end = Math.max(...shifted.map((n) => n.start + n.length))
  const totalBars = Math.ceil(end / barSteps)

  const header = `X:1\nT:${title}\nM:${meter}\nL:1/8\nQ:1/4=${tempo}\nK:C\n`
  for (let bars = totalBars; bars >= 1; bars--) {
    const abc = header + notesToAbcBody(firstSteps(shifted, bars * barSteps), meter, '1/8', 'C')
    if (abc.length <= maxLength) return { abc, bars, totalBars }
  }
  throw new Error('Even the first bar of this MIDI file is too long for one clip.')
}

/** The notes that start before `limit`, cut off at `limit`. */
function firstSteps(notes: Note[], limit: number): Note[] {
  return notes.filter((n) => n.start < limit).map((n) => ({ ...n, length: Math.min(n.length, limit - n.start) }))
}

/** "My Song.mid" -> "My Song". */
export function titleFromFileName(name: string): string {
  return name.replace(/\.midi?$/i, '').replace(/\s+/g, ' ').trim() || 'Imported MIDI'
}
