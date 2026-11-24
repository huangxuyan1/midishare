/**
 * Lines up the voices of multi-voice ABC.
 *
 * abcjs matches voices by text line: the first music line of V:1 goes with
 * the first music line of V:2, the second with the second, and so on. ABC
 * that gives one voice fewer lines than another is legal, and a MIDI export
 * writes it when a voice is mostly rests. abcjs then plays and draws it out
 * of step: the extra lines land in the wrong voice.
 *
 * lineUpVoices rewrites the music the way this app's own writer lays it out:
 * four bars per line, every voice in every group of lines, and short voices
 * padded with whole-bar rests (Z). The notes themselves are not changed.
 */

const BARS_PER_LINE = 4

type Voice = {
  /** The voice's first V: line as written, e.g. "V:2 clef=bass". */
  firstLine: string
  bars: string[]
}

/**
 * Returns the rewritten ABC, or null when the music has something this simple
 * rewrite can't place: lyrics, comments, a field in the middle of the tune,
 * an inline [V:] mark, music before the first V: line, or fewer than two voices.
 */
export function lineUpVoices(abc: string): string | null {
  const lines = abc.split('\n')
  const kIndex = lines.findIndex((line) => /^K:/.test(line))
  if (kIndex === -1) return null

  // Collect each voice's bars, in the order the voices first appear.
  const voices = new Map<string, Voice>()
  let current: Voice | undefined
  for (const line of lines.slice(kIndex + 1)) {
    if (line.trim() === '') continue
    const voiceLine = /^V:\s*(\S+)/.exec(line)
    if (voiceLine) {
      const id = voiceLine[1]
      if (!voices.has(id)) voices.set(id, { firstLine: line.trim(), bars: [] })
      current = voices.get(id)
    } else if (!current || /^[A-Za-z]:|^%|\[V:/.test(line)) {
      return null
    } else {
      current.bars.push(...splitIntoBars(line))
    }
  }
  if (voices.size < 2) return null

  const barCount = Math.max(...[...voices.values()].map((voice) => voice.bars.length))
  for (const voice of voices.values()) padWithRests(voice.bars, barCount)

  const body: string[] = []
  for (let first = 0; first < barCount; first += BARS_PER_LINE) {
    for (const [id, voice] of voices) {
      body.push(first === 0 ? voice.firstLine : `V:${id}`)
      body.push(voice.bars.slice(first, first + BARS_PER_LINE).join(' '))
    }
  }
  return [...lines.slice(0, kIndex + 1), ...body].join('\n')
}

/**
 * "c4 d4 | e8 |]" -> ["c4 d4 |", "e8 |]"]. Each bar keeps its closing bar
 * line. The text is only cut, never changed, except that a multi-bar rest
 * (Z6) becomes that many one-bar rests.
 */
function splitIntoBars(music: string): string[] {
  const bars: string[] = []
  let start = 0
  // Matches a quoted string ("Dm") or a bar line with what belongs to it (|, ||, |], |:, |1).
  for (const match of music.matchAll(/"[^"]*"|\|[\]|:]*\d*/g)) {
    if (match[0].startsWith('"')) continue // a | inside quotes is not a bar line
    const hasMusic = music.slice(start, match.index).trim() !== ''
    if (!hasMusic) continue // a bar line with nothing before it opens the next bar
    const end = match.index + match[0].length
    bars.push(music.slice(start, end).trim())
    start = end
  }
  const leftover = music.slice(start).trim() // a line that doesn't end with a bar line
  if (leftover !== '') bars.push(leftover)
  return bars.flatMap(expandMultiBarRest)
}

/** "Z3 |" -> ["Z |", "Z |", "Z |"]. Any other bar is returned as it is. */
function expandMultiBarRest(bar: string): string[] {
  const match = /^([ZX])(\d+)\s*(\|.*)?$/.exec(bar)
  if (!match) return [bar]
  const [, rest, count, barLine = '|'] = match
  const bars = Array.from({ length: Number(count) }, () => `${rest} |`)
  bars[bars.length - 1] = `${rest} ${barLine}`
  return bars
}

/** Adds whole-bar rests until the voice has `barCount` bars. The end mark |] moves to the new last bar. */
function padWithRests(bars: string[], barCount: number) {
  if (bars.length >= barCount) return
  if (bars.length > 0) bars[bars.length - 1] = bars[bars.length - 1].replace(/\|\]$/, '|')
  while (bars.length < barCount - 1) bars.push('Z |')
  bars.push('Z |]')
}
