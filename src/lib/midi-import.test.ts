import { describe, expect, it } from 'vitest'
import abcjs from 'abcjs'
import { checkAbc } from './abc'
import { readHeaders } from './abc-headers'
import { abcToNotes } from './abc-notes'
import { midiToAbc, readMidi, titleFromFileName } from './midi-import'

// Helpers that build a small MIDI file byte by byte.
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0))
const uint32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]

/** A track chunk around the given event bytes, with the end-of-track event added. */
function track(...events: number[]): number[] {
  const body = [...events, 0x00, 0xff, 0x2f, 0x00]
  return [...ascii('MTrk'), ...uint32(body.length), ...body]
}

/** A whole file. `division` is ticks per quarter note. */
function midiFile(division: number, ...tracks: number[][]): Uint8Array {
  const header = [...ascii('MThd'), ...uint32(6), 0, 1, 0, tracks.length, division >> 8, division & 255]
  return new Uint8Array([...header, ...tracks.flat()])
}

// With 96 ticks per quarter note, a 16th is 24 ticks.
const QUARTER = 96

describe('readMidi', () => {
  it('reads back the notes, tempo and meter of a .mid file the app itself writes', () => {
    const abc = 'X:1\nT:Round trip\nM:3/4\nL:1/8\nQ:1/4=132\nK:G\nB2 d2 g2 | [GBd]4 z2 | A/2B/2 c d3 e |]'
    const [bytes] = abcjs.synth.getMidiFile(abc, { midiOutputType: 'binary' }) as Uint8Array[]
    const midi = readMidi(bytes)
    expect(midi.notes).toEqual(abcToNotes(abc))
    expect(midi.tempo).toBe(132)
    expect(midi.meter).toBe('3/4')
  })

  it('merges every track into one, and takes the tempo and meter from wherever they are', () => {
    const bytes = midiFile(
      QUARTER,
      // Track 1: tempo 400000 microseconds per quarter (150 BPM), then time signature 3/4.
      track(0x00, 0xff, 0x51, 0x03, 0x06, 0x1a, 0x80, 0x00, 0xff, 0x58, 0x04, 3, 2, 24, 8),
      // Track 2: C4 for a quarter note.
      track(0x00, 0x90, 60, 100, QUARTER, 0x80, 60, 0),
      // Track 3, on channel 2: E4 for a quarter note, one quarter later.
      track(QUARTER, 0x91, 64, 100, QUARTER, 0x81, 64, 0),
    )
    expect(readMidi(bytes)).toEqual({
      notes: [
        { pitch: 60, start: 0, length: 4 },
        { pitch: 64, start: 4, length: 4 },
      ],
      tempo: 150,
      meter: '3/4',
    })
  })

  it('handles running status, note-on with velocity 0 as note-off, and long delta times', () => {
    const bytes = midiFile(
      QUARTER,
      track(
        ...[0x00, 0x90, 60, 100], // C4 on
        ...[QUARTER, 64, 100], // E4 on, a quarter later; the status byte is left out
        ...[0x81, 0x40, 60, 0], // 192 ticks later (two bytes): C4 "on" with velocity 0 ends it
        ...[0x00, 64, 0], // E4 ends at the same time
      ),
    )
    expect(readMidi(bytes).notes).toEqual([
      { pitch: 60, start: 0, length: 12 },
      { pitch: 64, start: 4, length: 8 },
    ])
  })

  it('snaps to the 16th-note grid and keeps a very short note one step long', () => {
    const bytes = midiFile(
      QUARTER,
      // Starts 5 ticks late and ends 5 ticks early; then a 3-tick blip at the third quarter.
      track(0x05, 0x90, 60, 100, QUARTER - 10, 0x80, 60, 0, QUARTER + 5, 0x90, 62, 100, 0x03, 0x80, 62, 0),
    )
    expect(readMidi(bytes).notes).toEqual([
      { pitch: 60, start: 0, length: 4 },
      { pitch: 62, start: 8, length: 1 },
    ])
  })

  it('skips the drum channel, and moves notes outside the piano roll by octaves', () => {
    const bytes = midiFile(
      QUARTER,
      track(
        ...[0x00, 0x99, 36, 100, QUARTER, 0x89, 36, 0], // channel 10: a kick drum
        ...[0x00, 0x90, 28, 100, QUARTER, 0x80, 28, 0], // E1, below the roll: becomes E2
        ...[0x00, 0x90, 100, 100, QUARTER, 0x80, 100, 0], // E7, above the roll: becomes E6
      ),
    )
    expect(readMidi(bytes).notes).toEqual([
      { pitch: 40, start: 4, length: 4 },
      { pitch: 88, start: 8, length: 4 },
    ])
  })

  it('skips events it has no use for: program change, controller, pitch bend, sysex, text', () => {
    const bytes = midiFile(
      QUARTER,
      track(
        ...[0x00, 0xc0, 5], // program change: one data byte
        ...[0x00, 0xb0, 7, 100], // controller
        ...[0x00, 0xe0, 0, 64], // pitch bend
        ...[0x00, 0xf0, 0x03, 1, 2, 0xf7], // system exclusive
        ...[0x00, 0xff, 0x03, 0x02, 0x48, 0x69], // track name "Hi"
        ...[0x00, 0x90, 60, 100, QUARTER, 0x80, 60, 0],
      ),
    )
    expect(readMidi(bytes).notes).toEqual([{ pitch: 60, start: 0, length: 4 }])
  })

  it('refuses files that are not MIDI, and SMPTE timing', () => {
    expect(() => readMidi(new Uint8Array(ascii('X:1\nK:C\nCDEF')))).toThrow('This is not a MIDI file.')
    expect(() => readMidi(new Uint8Array([]))).toThrow('This is not a MIDI file.')
    const smpte = midiFile(0xe728, track(0x00, 0x90, 60, 100, 40, 0x80, 60, 0))
    expect(() => readMidi(smpte)).toThrow('SMPTE')
  })
})

describe('midiToAbc', () => {
  // C4 then E4, a quarter note each, after one empty 4/4 bar (384 ticks = 0x83 0x00).
  const twoNotes = midiFile(QUARTER, track(0x83, 0x00, 0x90, 60, 100, QUARTER, 0x80, 60, 0, 0x00, 0x90, 64, 100, QUARTER, 0x80, 64, 0))

  it('writes a valid clip with the title, tempo and meter, and drops the empty bars before the first note', () => {
    const { abc, bars, totalBars } = midiToAbc(twoNotes, 'Two notes', 5000)
    expect(checkAbc(abc)).toEqual({ ok: true })
    expect(readHeaders(abc)).toMatchObject({ title: 'Two notes', tempo: 120, meter: '4/4', key: 'C' })
    expect(abcToNotes(abc)).toEqual([
      { pitch: 60, start: 0, length: 4 },
      { pitch: 64, start: 4, length: 4 },
    ])
    expect({ bars, totalBars }).toEqual({ bars: 1, totalBars: 1 })
  })

  it('cuts a file that is too long at a bar line', () => {
    // Forty bars of four quarter notes each.
    const events: number[] = []
    for (let i = 0; i < 160; i++) events.push(0x00, 0x90, 60 + (i % 12), 100, QUARTER, 0x80, 60 + (i % 12), 0)
    const long = midiFile(QUARTER, track(...events))

    const whole = midiToAbc(long, 'Long', 5000)
    expect({ bars: whole.bars, totalBars: whole.totalBars }).toEqual({ bars: 40, totalBars: 40 })

    const cut = midiToAbc(long, 'Long', 300)
    expect(cut.abc.length).toBeLessThanOrEqual(300)
    expect(cut.totalBars).toBe(40)
    expect(cut.bars).toBeLessThan(40)
    expect(checkAbc(cut.abc)).toEqual({ ok: true })
    // The clip is exactly the first bars: four notes in each.
    expect(abcToNotes(cut.abc)).toEqual(abcToNotes(whole.abc).slice(0, cut.bars * 4))
  })

  it('says so when the file has no notes', () => {
    const empty = midiFile(QUARTER, track(0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20))
    expect(() => midiToAbc(empty, 'Empty', 5000)).toThrow('No notes were found in this MIDI file.')
  })
})

describe('titleFromFileName', () => {
  it('drops the extension and tidies spaces', () => {
    expect(titleFromFileName('My  Song.mid')).toBe('My Song')
    expect(titleFromFileName('take 2.MIDI')).toBe('take 2')
    expect(titleFromFileName('.mid')).toBe('Imported MIDI')
  })
})
