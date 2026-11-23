import { describe, expect, it } from 'vitest'
import { abcToNotes, keySignature, notesToAbcBody, sortNotes, writeNotesIntoAbc, type Note } from './abc-notes'
import { readHeaders, setHeader } from './abc-headers'
import { checkAbc, EXAMPLE_ABC } from './abc'

const HEAD = 'X:1\nT:Test\nM:4/4\nL:1/8\nQ:1/4=90\n'

/** notes -> ABC -> notes should give back the same notes. */
function roundTrip(notes: Note[], key = 'C', meter = '4/4') {
  const abc = writeNotesIntoAbc(`X:1\nM:${meter}\nL:1/8\nK:${key}\n`, notes)
  expect(checkAbc(abc)).toEqual({ ok: true })
  return { abc, back: abcToNotes(abc) }
}

describe('abcToNotes', () => {
  it('reads pitches, starts and lengths in 16ths, with the key signature applied', () => {
    // K:D sharpens F and C. c4- c2 is one tied note of 6 eighths.
    expect(abcToNotes(`${HEAD}K:D\nD2 [FA]2 c4- | c2 z2 _B2 B2 |]`)).toEqual([
      { pitch: 62, start: 0, length: 4 },
      { pitch: 66, start: 4, length: 4 },
      { pitch: 69, start: 4, length: 4 },
      { pitch: 73, start: 8, length: 12 },
      // _B applies to the rest of the bar, so both are B flat.
      { pitch: 70, start: 24, length: 4 },
      { pitch: 70, start: 28, length: 4 },
    ])
  })

  it('turns chord symbols into real notes', () => {
    const notes = abcToNotes(`${HEAD}K:C\n"Dm"D4 F4 |]`)
    expect(notes.length).toBeGreaterThan(2) // the melody plus bass and chord notes
    expect(notes.some((n) => n.pitch < 50)).toBe(true) // a bass note under the melody
  })

  it('reads lengths that are not one written note value', () => {
    // F5 is five eighths (10 sixteenths); z5 pushes the last note to the end of bar 2.
    expect(abcToNotes(`${HEAD}K:C\nF5 z3 | z5 A3 |]`)).toEqual([
      { pitch: 65, start: 0, length: 10 },
      { pitch: 69, start: 26, length: 6 },
    ])
  })
})

describe('notes -> ABC -> notes', () => {
  it('keeps single notes, rests and chords', () => {
    const notes = sortNotes([
      { pitch: 60, start: 0, length: 2 },
      { pitch: 64, start: 4, length: 4 },
      { pitch: 67, start: 4, length: 4 },
      { pitch: 72, start: 12, length: 1 },
    ])
    expect(roundTrip(notes).back).toEqual(notes)
  })

  it('keeps overlapping notes of different lengths (ties inside chords)', () => {
    const notes = sortNotes([
      { pitch: 48, start: 0, length: 16 }, // a whole-bar bass note
      { pitch: 64, start: 0, length: 4 },
      { pitch: 65, start: 6, length: 3 },
    ])
    expect(roundTrip(notes).back).toEqual(notes)
  })

  it('ties notes across bar lines', () => {
    const notes = [{ pitch: 67, start: 12, length: 8 }]
    const { abc, back } = roundTrip(notes)
    expect(abc).toContain('|')
    expect(back).toEqual(notes)
  })

  it('writes accidentals against the key and the bar', () => {
    // In D major: F natural, then F sharp again in the same bar, then F natural in the next bar.
    const notes = [
      { pitch: 65, start: 0, length: 2 },
      { pitch: 66, start: 2, length: 2 },
      { pitch: 65, start: 16, length: 2 },
    ]
    expect(roundTrip(notes, 'D').back).toEqual(notes)
    // Black keys in a flat key, very low and very high notes.
    const wide = [
      { pitch: 70, start: 0, length: 2 },
      { pitch: 36, start: 2, length: 2 },
      { pitch: 96, start: 4, length: 2 },
    ]
    expect(roundTrip(wide, 'F').back).toEqual(wide)
  })

  it('works in other meters', () => {
    const notes = [{ pitch: 60, start: 0, length: 12 }, { pitch: 62, start: 12, length: 6 }]
    expect(roundTrip(notes, 'C', '3/4').back).toEqual(notes)
    expect(roundTrip(notes, 'G', '6/8').back).toEqual(notes)
  })

  it('round-trips the example clip, writing overlapping parts as separate voices', () => {
    // Its chord symbols expand into bass and chord notes under the melody.
    const notes = abcToNotes(EXAMPLE_ABC)
    const abc = writeNotesIntoAbc(EXAMPLE_ABC, notes)
    expect(abc).toContain('V:1\nD2 F2 A2 d2 |')
    expect(abc).toContain('V:2 clef=bass')
    expect(abcToNotes(abc)).toEqual(notes)
  })

  it('writes an empty clip as one bar of rest', () => {
    expect(notesToAbcBody([], '4/4', '1/8', 'C')).toBe('z8 |]')
  })

  it('keeps the header lines and replaces the music', () => {
    const abc = writeNotesIntoAbc(`${HEAD}K:Dm\n"Dm"D8 |]`, [{ pitch: 62, start: 0, length: 4 }])
    expect(abc).toBe(`${HEAD}K:Dm\nD2 z6 |]`) // a quarter note is D2 when L:1/8
  })
})

describe('keySignature', () => {
  it('handles major, minor and modes', () => {
    expect(keySignature('C')).toEqual({})
    expect(keySignature('D')).toEqual({ F: 1, C: 1 })
    expect(keySignature('Dm')).toEqual({ B: -1 })
    expect(keySignature('Bb')).toEqual({ B: -1, E: -1 })
    expect(keySignature('Ddor')).toEqual({})
  })
})

describe('headers', () => {
  it('reads the metadata', () => {
    expect(readHeaders(`${HEAD}K:Dm clef=bass\nD8|]`)).toEqual({
      title: 'Test', meter: '4/4', unitLength: '1/8', tempo: 90, key: 'Dm',
    })
  })

  it('replaces a header or inserts it before K:', () => {
    expect(setHeader('X:1\nQ:1/4=90\nK:C\nC8|]', 'Q', '1/4=120')).toBe('X:1\nQ:1/4=120\nK:C\nC8|]')
    expect(setHeader('X:1\nK:C\nC8|]', 'T', 'Hi')).toBe('X:1\nT:Hi\nK:C\nC8|]')
  })
})
