import { describe, expect, it } from 'vitest'
import { checkAbc, EXAMPLE_ABC, parseTags } from './abc'

describe('checkAbc', () => {
  it('accepts the example clip', () => {
    expect(checkAbc(EXAMPLE_ABC)).toEqual({ ok: true })
  })

  it('accepts a minimal tune', () => {
    expect(checkAbc('X:1\nK:C\nCDEF GABc|')).toEqual({ ok: true })
  })

  it('rejects empty text', () => {
    expect(checkAbc('  ').ok).toBe(false)
  })

  it('rejects text without a K: header', () => {
    expect(checkAbc('CDEF GABc|').ok).toBe(false)
  })

  it('rejects text abcjs only partly understands', () => {
    // abcjs reads the "e" in "hello" as a note and warns about the rest.
    expect(checkAbc('X:1\nK:C\nhello').ok).toBe(false)
  })
})

describe('parseTags', () => {
  it('splits, trims, lowercases and drops empty tags', () => {
    expect(parseTags('lofi, Chords ,,d minor')).toEqual(['lofi', 'chords', 'd minor'])
  })
})
