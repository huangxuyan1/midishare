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

  it('accepts lengths that are not one written note value', () => {
    // Five eighths: legal ABC, but abcjs warns that it can't draw it as one symbol.
    expect(checkAbc('X:1\nM:4/4\nL:1/8\nK:C\nz2 A z5 |]')).toEqual({ ok: true })
    expect(checkAbc('X:1\nM:4/4\nL:1/8\nK:C\nF5 z3 |]')).toEqual({ ok: true })
  })

  it('still reports other warnings next to an odd length', () => {
    const check = checkAbc('X:1\nM:4/4\nL:1/8\nK:C\nz5 hello |]')
    expect(check.ok).toBe(false)
    if (!check.ok) expect(check.errors.join(' ')).not.toContain('Duration not representable')
  })
})

describe('parseTags', () => {
  it('splits, trims, lowercases and drops empty tags', () => {
    expect(parseTags('lofi, Chords ,,d minor')).toEqual(['lofi', 'chords', 'd minor'])
  })
})
