import { describe, expect, it } from 'vitest'
import { checkAbc } from './abc'
import { abcToNotes } from './abc-notes'
import { previewAbc } from './note-preview'

describe('previewAbc', () => {
  it('writes a valid one-note clip for every pitch in the piano roll (C2 to B6)', () => {
    for (let pitch = 36; pitch <= 95; pitch++) {
      const abc = previewAbc(pitch)
      expect(checkAbc(abc), abc).toEqual({ ok: true })
      expect(abcToNotes(abc)).toEqual([{ pitch, start: 0, length: 2 }])
    }
  })

  it('spells black keys as sharps and marks the octave', () => {
    // With L:1/8 the eighth note has no length number; rests fill the bar.
    expect(previewAbc(60)).toContain('K:C\nC z')
    expect(previewAbc(61)).toContain('K:C\n^C z')
    expect(previewAbc(72)).toContain('K:C\nc z')
    expect(previewAbc(48)).toContain('K:C\nC, z')
  })
})
