import { describe, expect, it } from 'vitest'
import { checkAbc } from '@/lib/abc'
import { abcToNotes, barLengthInSteps } from '@/lib/abc-notes'
import { DEMO_ABC, DEMO_BAR_STEPS, DEMO_METER, DEMO_NOTES } from './demo-clip'

describe('the landing page demo clip', () => {
  it('is valid ABC', () => {
    expect(checkAbc(DEMO_ABC)).toEqual({ ok: true })
  })

  it('shows the notes its ABC text stands for', () => {
    expect(abcToNotes(DEMO_ABC)).toEqual(DEMO_NOTES)
  })

  it('uses the bar length of its meter', () => {
    expect(barLengthInSteps(DEMO_METER)).toBe(DEMO_BAR_STEPS)
  })
})
