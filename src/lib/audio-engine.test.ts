import { afterEach, describe, expect, it, vi } from 'vitest'
import { withFallback, type AudioEngine } from './audio-engine'

const context = {} as AudioContext
const mainBuffer = { name: 'from the main engine' } as unknown as AudioBuffer
const backupBuffer = { name: 'from the backup engine' } as unknown as AudioBuffer

/** An engine that always gives back the same buffer, and counts its renders. */
function fixedEngine(buffer: AudioBuffer | null) {
  const made = { renders: 0 }
  const engine: AudioEngine = {
    async render() {
      made.renders++
      return buffer
    },
  }
  return { engine, made }
}

const failingEngine: AudioEngine = {
  render: async () => {
    throw new Error('the module could not be downloaded')
  },
}

describe('withFallback', () => {
  afterEach(() => vi.restoreAllMocks())

  it('uses the main engine when it works, and leaves the backup alone', async () => {
    const main = fixedEngine(mainBuffer)
    const backup = fixedEngine(backupBuffer)

    expect(await withFallback(main.engine, backup.engine).render('abc', context)).toBe(mainBuffer)
    expect(backup.made.renders).toBe(0)
  })

  it('uses the backup when the main engine fails, and says so in the console', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const backup = fixedEngine(backupBuffer)

    expect(await withFallback(failingEngine, backup.engine).render('abc', context)).toBe(backupBuffer)
    expect(warn).toHaveBeenCalledOnce()
  })

  it('does not use the backup when the main engine finds nothing to play', async () => {
    const main = fixedEngine(null)
    const backup = fixedEngine(backupBuffer)

    expect(await withFallback(main.engine, backup.engine).render('abc', context)).toBeNull()
    expect(backup.made.renders).toBe(0)
  })
})
