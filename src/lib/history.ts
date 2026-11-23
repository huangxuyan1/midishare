/**
 * Undo/redo history for one value.
 *
 * - `past`: the earlier values, oldest first
 * - `present`: the value shown now
 * - `future`: the values that were undone, next redo first
 *
 * Every function returns a new history and changes nothing in place, so they
 * work as useState updaters: `setHistory(undo)`.
 */
export type History<T> = {
  past: T[]
  present: T
  future: T[]
}

/** Older steps are dropped, so a long session can't grow without limit. */
const MAX_STEPS = 100

export function startHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] }
}

/** A new step: the old present can be undone to. Redo is cleared. */
export function pushStep<T>(history: History<T>, next: T): History<T> {
  const past = [...history.past, history.present].slice(-MAX_STEPS)
  return { past, present: next, future: [] }
}

/** Changes the present without adding a step (used while typing). */
export function replacePresent<T>(history: History<T>, next: T): History<T> {
  return { ...history, present: next }
}

export function undo<T>(history: History<T>): History<T> {
  if (history.past.length === 0) return history
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
  }
}

export function redo<T>(history: History<T>): History<T> {
  if (history.future.length === 0) return history
  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
  }
}
