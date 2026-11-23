/**
 * Read and change ABC header lines (T: title, M: meter, L: unit length,
 * Q: tempo, K: key). The metadata fields on the editor use these, so the
 * fields and the ABC text stay in sync both ways.
 */

export type AbcHeaders = {
  title: string
  meter: string
  unitLength: string
  /** Beats per minute, from Q:1/4=90 (or Q:90). */
  tempo: number
  key: string
}

const DEFAULTS: AbcHeaders = { title: '', meter: '4/4', unitLength: '1/8', tempo: 120, key: 'C' }

export function readHeaders(abc: string): AbcHeaders {
  const value = (letter: string) => new RegExp(`^${letter}:\\s*(.*)$`, 'm').exec(abc)?.[1].trim()
  const tempoText = value('Q')
  const bpm = tempoText ? Number(/(\d+)\s*$/.exec(tempoText)?.[1]) : NaN
  return {
    title: value('T') ?? DEFAULTS.title,
    meter: value('M') || DEFAULTS.meter,
    unitLength: value('L') || DEFAULTS.unitLength,
    tempo: Number.isFinite(bpm) ? bpm : DEFAULTS.tempo,
    // abcjs allows extras after the key, e.g. "Dm clef=bass"; keep just the key.
    key: (value('K') ?? DEFAULTS.key).split(/\s+/)[0] || DEFAULTS.key,
  }
}

/**
 * Sets one header line, e.g. setHeader(abc, 'Q', '1/4=100'). Replaces the
 * first existing line; otherwise inserts it just before K: (which must stay
 * the last header).
 */
export function setHeader(abc: string, letter: 'T' | 'M' | 'L' | 'Q' | 'K', value: string): string {
  const lines = abc.split('\n')
  const line = `${letter}:${value}`
  const existing = lines.findIndex((l) => l.startsWith(`${letter}:`))
  if (existing !== -1) {
    lines[existing] = line
  } else {
    const kIndex = lines.findIndex((l) => l.startsWith('K:'))
    lines.splice(kIndex === -1 ? lines.length : kIndex, 0, line)
  }
  return lines.join('\n')
}
