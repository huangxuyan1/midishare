import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { abcToMidi, EXAMPLE_ABC } from './src/lib/abc'
import { previewAbc } from './src/lib/note-preview'
import { loadModular, type Instrument, type Modular } from './src/modular/modular.mjs'

// The real Modular module and the real piano, not fakes. The module runs in
// Node as well as in a browser, so these tests render actual sound. They read
// the piano from disk with Node, so they live at the project root (see
// vitest.config.ts).
const PIANO = 'src/assets/piano/fluidr3-gm-0-0-yamaha-grand-piano.sf2'
const RATE = 44100

/** The loudest sample, as a positive number. */
function peak(samples: Float32Array) {
  let loudest = 0
  for (const sample of samples) loudest = Math.max(loudest, Math.abs(sample))
  return loudest
}

describe('Modular with the piano soundfont', () => {
  let modular: Modular
  let piano: Instrument

  beforeAll(async () => {
    modular = await loadModular()
    piano = await modular.createInstrument(readFileSync(PIANO))
  })

  it('renders the example clip as stereo sound of the right length', async () => {
    const { sampleRate, channels } = await piano.render(abcToMidi(EXAMPLE_ABC), RATE)
    const [left, right] = channels

    expect(sampleRate).toBe(RATE)
    expect(right.length).toBe(left.length)
    // The example is 4 bars of 4 beats at 90 beats a minute. Modular renders
    // all of that, then up to 2 more seconds while the last notes die away.
    const clipSeconds = (16 * 60) / 90
    const seconds = left.length / RATE
    expect(seconds).toBeGreaterThan(clipSeconds - 0.01)
    expect(seconds).toBeLessThan(clipSeconds + 2.01)
    // It is sound, not silence, and no sample is NaN or infinite.
    expect(peak(left)).toBeGreaterThan(0.01)
    expect(peak(right)).toBeGreaterThan(0.01)
    expect(left.every(Number.isFinite) && right.every(Number.isFinite)).toBe(true)
  })

  it('renders a one-note preview', async () => {
    const { channels } = await piano.render(abcToMidi(previewAbc(60)), RATE)

    expect(channels[0].length).toBeGreaterThan(0)
    expect(peak(channels[0])).toBeGreaterThan(0.01)
  })

  it("rejects bytes that are not a MIDI file with Modular's message, and still works afterwards", async () => {
    await expect(piano.render(new Uint8Array([1, 2, 3]), RATE)).rejects.toThrow('midi file')

    const { channels } = await piano.render(abcToMidi(previewAbc(60)), RATE)
    expect(channels[0].length).toBeGreaterThan(0)
  })

  it("rejects bytes that are not a soundfont with Modular's message", async () => {
    await expect(modular.createInstrument(new Uint8Array([1, 2, 3]))).rejects.toThrow('soundfont')
  })
})
