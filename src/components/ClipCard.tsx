/**
 * One clip in the library grid: a small piano roll of its notes, the title,
 * its key / meter / tempo, and its tags. Hovering the card runs a playhead
 * across the roll at the clip's real speed (no sound).
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { RecordData } from 'deepspace'
import { Badge } from '@/components/ui'
import { MiniRoll } from './MiniRoll'
import { checkAbc, parseTags } from '@/lib/abc'
import { readHeaders } from '@/lib/abc-headers'
import { abcToNotes, barLengthInSteps } from '@/lib/abc-notes'
import type { Clip } from '@/schemas/clips-schema'

export function ClipCard({ clip }: { clip: RecordData<Clip> }) {
  const { title, abc, tags, status } = clip.data
  const headers = readHeaders(abc)
  const barSteps = barLengthInSteps(headers.meter)
  // Parsing the ABC is the slow part of drawing a card, so do it once per clip text.
  const notes = useMemo(() => (checkAbc(abc).ok ? abcToNotes(abc) : []), [abc])

  const lastEnd = Math.max(barSteps, ...notes.map((n) => n.start + n.length))
  const bars = Math.ceil(lastEnd / barSteps)
  // A step is a 16th note, so 4 steps are one beat of the Q:1/4= tempo.
  const seconds = ((bars * barSteps) / 4) * (60 / headers.tempo)

  return (
    <Link
      to={`/clips/${clip.recordId}`}
      data-testid="clip-row"
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card outline-none transition-colors hover:border-primary focus-visible:border-primary"
    >
      <MiniRoll notes={notes} barSteps={barSteps} sweep="hover" sweepSeconds={seconds} className="h-24 border-b border-border" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium leading-snug">{title}</h3>
          {status === 'draft' && <Badge variant="secondary">Draft</Badge>}
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          {headers.key} · {headers.meter} · {headers.tempo} BPM · {bars} {bars === 1 ? 'bar' : 'bars'}
        </p>
        {tags && (
          <div className="mt-auto flex flex-wrap gap-1 pt-1">
            {parseTags(tags).map((t) => (
              <Badge key={t} variant="outline">
                #{t}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
