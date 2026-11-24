import { describe, expect, it } from 'vitest'
import { checkAbc, VOICES_OUT_OF_STEP } from './abc'
import { abcToNotes } from './abc-notes'
import { lineUpVoices } from './abc-voices'

const HEAD = 'X:1\nT:9-Nexus\nM:4/4\nL:1/8\nQ:1/4=140\nK:A\n'
const MELODY_1 = 'B2 A G2 z3 | z3 E E F2 F- | F G2 E2 z3 | z3 B, E F2 F- |'
const MELODY_2 = 'F3 C3 z2 | z3 E2 F2 B- | B3 G3 z F- | F E2 B,2 E F2 |]'

// As exported from Ableton by the MIDI Clipboard bridge: V:1 has one line, V:2 has two.
const EXPORTED = `${HEAD}V:1\nZ6 | z2 A z5 |]\nV:2\n${MELODY_1}\n${MELODY_2}`

describe('checkAbc with voices', () => {
  it('rejects voices with different numbers of music lines', () => {
    expect(checkAbc(EXPORTED)).toEqual({ ok: false, errors: [VOICES_OUT_OF_STEP] })
  })

  it('accepts voices that have the same number of lines', () => {
    expect(checkAbc(`${HEAD}V:1\nc8 | d8 |\nV:2\nC8 | D8 |\nV:1\ne8 |]\nV:2\nE8 |]`)).toEqual({ ok: true })
  })

  it('accepts one voice on several lines', () => {
    expect(checkAbc(`${HEAD}${MELODY_1}\n${MELODY_2}`)).toEqual({ ok: true })
  })
})

describe('lineUpVoices', () => {
  it('writes four bars per line with every voice in each group', () => {
    expect(lineUpVoices(EXPORTED)).toBe(
      `${HEAD}` +
        'V:1\nZ | Z | Z | Z |\n' +
        `V:2\n${MELODY_1}\n` +
        'V:1\nZ | Z | z2 A z5 | Z |]\n' + // the missing eighth bar is a rest, and |] moved to it
        `V:2\n${MELODY_2}`,
    )
  })

  it('gives ABC that passes the check and puts every note where it belongs', () => {
    const linedUp = lineUpVoices(EXPORTED)!
    expect(checkAbc(linedUp)).toEqual({ ok: true })
    const notes = abcToNotes(linedUp)
    expect(notes).toHaveLength(24)
    // The lone A of V:1 is in bar 7: six bars of 16 steps, then a quarter rest.
    expect(notes).toContainEqual({ pitch: 69, start: 100, length: 2 })
    // Bar 5 of the melody starts at step 64. Before the fix it started at 112.
    expect(notes).toContainEqual({ pitch: 61, start: 70, length: 6 }) // the C3 (C sharp in A major)
    expect(Math.max(...notes.map((n) => n.start + n.length))).toBe(8 * 16)
  })

  it('keeps the first V: line as written and does not cut inside quotes or before an opening bar line', () => {
    const abc = 'X:1\nK:C\nV:1\n|: "C|G"c8 | d8 :|\ne8 |]\nV:2 clef=bass\nC,8 | D,8 | E,8 |]'
    expect(lineUpVoices(abc)).toBe('X:1\nK:C\nV:1\n|: "C|G"c8 | d8 :| e8 |]\nV:2 clef=bass\nC,8 | D,8 | E,8 |]')
  })

  it('returns null when it cannot place something', () => {
    expect(lineUpVoices(`${HEAD}${MELODY_1}\n${MELODY_2}`)).toBeNull() // one voice
    expect(lineUpVoices('X:1\nK:C\nV:1\nc8 |\nw: la\nd8 |\nV:2\nC8 | D8 |')).toBeNull() // lyrics
    expect(lineUpVoices('X:1\nK:C\n[V:1] c8 |\n[V:1] d8 |\n[V:2] C8 | D8 |')).toBeNull() // inline voice marks
  })
})
