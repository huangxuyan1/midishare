/**
 * Renders ABC as sheet music, light on dark like the piano roll. abcjs draws
 * in the current text color, so text-foreground sets the color of the notes.
 * Playback is separate: see usePlayback and Transport, which the editor and
 * the clip page both use.
 */
import { useEffect, useRef } from 'react'
import abcjs from 'abcjs'

export function AbcView({ abc }: { abc: string }) {
  const scoreRef = useRef<HTMLDivElement>(null)

  // Redraw the notation whenever the ABC changes.
  useEffect(() => {
    if (!scoreRef.current) return
    abcjs.renderAbc(scoreRef.current, abc, { responsive: 'resize', add_classes: true })
  }, [abc])

  return <div ref={scoreRef} data-testid="abc-notation" className="rounded-md border border-border bg-roll p-3 text-foreground" />
}
