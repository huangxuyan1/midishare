import { describe, expect, it } from 'vitest'
import { pushStep, redo, replacePresent, startHistory, undo } from './history'

describe('history', () => {
  it('starts with nothing to undo or redo', () => {
    expect(startHistory('a')).toEqual({ past: [], present: 'a', future: [] })
  })

  it('undo goes back one step and redo comes forward again', () => {
    const edited = pushStep(pushStep(startHistory('a'), 'b'), 'c')
    const undone = undo(edited)
    expect(undone).toEqual({ past: ['a'], present: 'b', future: ['c'] })
    expect(redo(undone)).toEqual(edited)
  })

  it('undo and redo walk through several steps in order', () => {
    let h = pushStep(pushStep(startHistory('a'), 'b'), 'c')
    h = undo(undo(h))
    expect(h).toEqual({ past: [], present: 'a', future: ['b', 'c'] })
    h = redo(redo(h))
    expect(h).toEqual({ past: ['a', 'b'], present: 'c', future: [] })
  })

  it('does nothing when there is no step to undo or redo', () => {
    const h = startHistory('a')
    expect(undo(h)).toBe(h)
    expect(redo(h)).toBe(h)
  })

  it('a new step after an undo clears redo', () => {
    const h = pushStep(undo(pushStep(startHistory('a'), 'b')), 'c')
    expect(h).toEqual({ past: ['a'], present: 'c', future: [] })
  })

  it('replacePresent changes the value without adding a step', () => {
    const h = replacePresent(pushStep(startHistory('a'), 'b'), 'bb')
    expect(h).toEqual({ past: ['a'], present: 'bb', future: [] })
    expect(undo(h).present).toBe('a')
  })

  it('keeps only the last 100 steps', () => {
    let h = startHistory(0)
    for (let i = 1; i <= 150; i++) h = pushStep(h, i)
    expect(h.past.length).toBe(100)
    expect(h.past[0]).toBe(50)
    expect(h.present).toBe(150)
  })
})
