import { describe, expect, it } from 'vitest'
import { abcToMidi, EXAMPLE_ABC } from './abc'
import { readMidi } from './midi-import'
import { soundfontVelocity, withSoundfontVelocities } from './midi-velocity'

/** Every note-on in the file as [pitch, velocity], found by its status byte 0x90 to 0x9F. */
function noteOns(midi: Uint8Array): [number, number][] {
  const found: [number, number][] = []
  for (let i = 0; i + 2 < midi.length; i++) {
    if ((midi[i] & 0xf0) === 0x90 && midi[i + 1] < 128 && midi[i + 2] > 0 && midi[i + 2] < 128) {
      found.push([midi[i + 1], midi[i + 2]])
    }
  }
  return found
}

describe('soundfontVelocity', () => {
  it("turns abcjs's three accents into velocities that a SoundFont plays in the same proportion", () => {
    expect([105, 95, 85].map(soundfontVelocity)).toEqual([115, 110, 104])
    // The SoundFont rule squares the velocity: the squares are as 105 : 95 : 85, within rounding.
    expect(115 ** 2 / 104 ** 2).toBeCloseTo(105 / 85, 1)
    expect(110 ** 2 / 104 ** 2).toBeCloseTo(95 / 85, 1)
  })

  it('keeps the ends of the range', () => {
    expect(soundfontVelocity(127)).toBe(127)
    expect(soundfontVelocity(1)).toBe(11)
  })
})

describe('withSoundfontVelocities', () => {
  // One bar: beat 1, between beats, beat 4.
  const abc = 'X:1\nM:4/4\nL:1/8\nQ:1/4=60\nK:C\nc2 z c z2 c2 |]'

  it('rewrites the velocity of every note and nothing else', () => {
    const original = abcToMidi(abc)
    const rewritten = withSoundfontVelocities(original)

    expect(noteOns(original)).toEqual([[72, 105], [72, 85], [72, 95]])
    expect(noteOns(rewritten)).toEqual([[72, 115], [72, 104], [72, 110]])
    // Same length, and only those three bytes differ.
    expect(rewritten.length).toBe(original.length)
    expect(rewritten.filter((byte, i) => byte !== original[i])).toHaveLength(3)
  })

  it('leaves the file it was given unchanged', () => {
    const original = abcToMidi(abc)
    const before = [...original]

    withSoundfontVelocities(original)

    expect([...original]).toEqual(before)
  })

  it('keeps the notes and their timing, in a clip with chord symbols and two tracks', () => {
    const original = abcToMidi(EXAMPLE_ABC)
    const rewritten = withSoundfontVelocities(original)

    expect(readMidi(rewritten)).toEqual(readMidi(original))
    // The accompaniment's quieter notes are rewritten too: 64 and 48 become 90 and 78.
    const velocities = new Set(noteOns(rewritten).map(([, velocity]) => velocity))
    expect([...velocities].sort((a, b) => a - b)).toEqual([78, 90, 110, 115])
  })

  it('gives back bytes that are not a MIDI file as they are', () => {
    expect([...withSoundfontVelocities(new Uint8Array([1, 2, 3]))]).toEqual([1, 2, 3])
  })
})
