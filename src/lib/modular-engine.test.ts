import { describe, expect, it } from 'vitest'
import { abcToMidi, EXAMPLE_ABC } from './abc'
import { modularEngine, type ModularInstrument } from './modular-engine'
import { previewAbc } from './note-preview'

/** Stands in for the browser's AudioContext: remembers what was copied into each buffer. */
function fakeContext(sampleRate: number) {
  const buffers: { channelCount: number; length: number; sampleRate: number; channels: Float32Array[] }[] = []
  const context = {
    sampleRate,
    createBuffer(channelCount: number, length: number, rate: number) {
      const made = { channelCount, length, sampleRate: rate, channels: [] as Float32Array[] }
      buffers.push(made)
      return {
        copyToChannel(samples: Float32Array, channel: number) {
          made.channels[channel] = samples
        },
      }
    },
  }
  return { context: context as unknown as AudioContext, buffers }
}

/** Stands in for Modular: remembers what it was asked to render and answers with fixed samples. */
function fakeInstrument(left: number[], right: number[]) {
  const calls: { midi: Uint8Array; sampleRate: number }[] = []
  const instrument: ModularInstrument = {
    async render(midi, sampleRate) {
      calls.push({ midi, sampleRate })
      return { sampleRate, channels: [new Float32Array(left), new Float32Array(right)] }
    },
  }
  return { instrument, calls }
}

describe('modularEngine', () => {
  it("sends Modular the clip's Download .mid bytes and the context's sample rate", async () => {
    const { instrument, calls } = fakeInstrument([0.5], [0.25])
    const { context } = fakeContext(48000)

    await modularEngine(async () => instrument).render(EXAMPLE_ABC, context)

    expect(calls).toHaveLength(1)
    expect(calls[0].sampleRate).toBe(48000)
    expect(calls[0].midi).toEqual(abcToMidi(EXAMPLE_ABC))
    // A Standard MIDI File starts with the four letters "MThd".
    expect(String.fromCharCode(...calls[0].midi.slice(0, 4))).toBe('MThd')
  })

  it('copies the left and right samples into a stereo buffer of the same length and rate', async () => {
    const { instrument } = fakeInstrument([0.5, -0.5, 0], [0.25, -0.25, 0])
    const { context, buffers } = fakeContext(44100)

    const buffer = await modularEngine(async () => instrument).render(EXAMPLE_ABC, context)

    expect(buffer).not.toBeNull()
    expect(buffers).toHaveLength(1)
    expect(buffers[0]).toMatchObject({ channelCount: 2, length: 3, sampleRate: 44100 })
    expect([...buffers[0].channels[0]]).toEqual([0.5, -0.5, 0])
    expect([...buffers[0].channels[1]]).toEqual([0.25, -0.25, 0])
  })

  it('loads the instrument once and uses it for every render', async () => {
    const { instrument, calls } = fakeInstrument([0.5], [0.5])
    const { context } = fakeContext(48000)
    let loads = 0
    const engine = modularEngine(async () => {
      loads++
      return instrument
    })

    // Two renders started together, as when a preview is asked for while a clip is being rendered.
    await Promise.all([engine.render(EXAMPLE_ABC, context), engine.render(previewAbc(60), context)])

    expect(loads).toBe(1)
    expect(calls).toHaveLength(2)
  })

  it('a note preview reaches Modular as a MIDI file holding that pitch', async () => {
    const { instrument, calls } = fakeInstrument([0.5], [0.5])
    const { context } = fakeContext(48000)

    await modularEngine(async () => instrument).render(previewAbc(61), context)

    // A note-on is the byte 0x90 (channel 1) followed by the pitch and the velocity.
    const bytes = [...calls[0].midi]
    const noteOn = bytes.findIndex((byte, i) => byte === 0x90 && bytes[i + 2] > 0)
    expect(bytes[noteOn + 1]).toBe(61)
  })

  it('gives back no buffer when Modular renders nothing', async () => {
    const { instrument } = fakeInstrument([], [])
    const { context, buffers } = fakeContext(48000)

    expect(await modularEngine(async () => instrument).render(EXAMPLE_ABC, context)).toBeNull()
    expect(buffers).toHaveLength(0)
  })

  it("passes on Modular's error when a render fails", async () => {
    const instrument: ModularInstrument = {
      render: async () => {
        throw new Error('the clip is longer than ten minutes')
      },
    }
    const { context } = fakeContext(48000)

    await expect(modularEngine(async () => instrument).render(EXAMPLE_ABC, context)).rejects.toThrow('longer than ten minutes')
  })
})
