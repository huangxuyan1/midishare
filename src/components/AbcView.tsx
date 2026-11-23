/**
 * Renders ABC as sheet music, in ink on a sheet of paper. Playback is
 * separate: see usePlayback and Transport, which the editor and the clip page
 * both use.
 */
import { useEffect, useRef } from 'react'
import abcjs from 'abcjs'

export function AbcView({ abc }: { abc: string }) {
  const paperRef = useRef<HTMLDivElement>(null)

  // Redraw the notation whenever the ABC changes.
  useEffect(() => {
    if (!paperRef.current) return
    abcjs.renderAbc(paperRef.current, abc, { responsive: 'resize', add_classes: true })
  }, [abc])

  return <div ref={paperRef} data-testid="abc-notation" className="rounded-md bg-paper p-3 text-paper-foreground" />
}
