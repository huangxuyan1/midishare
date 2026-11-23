/**
 * The clip editor, shared by the create page and the edit page.
 *
 * The ABC text is the single source of truth. Everything else is a view of it
 * that writes back to it:
 * - the piano roll shows abcToNotes(abc); a roll edit rewrites the music lines
 * - title, tempo, meter and key show the header lines; editing one rewrites
 *   that header (meter and key also rewrite the music so the notes stay put)
 * - the sheet music preview renders the ABC
 * Saving is disabled until the ABC parses.
 */
import { useMemo, useRef, useState } from 'react'
import { Button, Input, Label, Textarea } from '@/components/ui'
import { AbcView } from './AbcView'
import { AiAssist } from './AiAssist'
import { MetadataFields } from './MetadataFields'
import { PianoRoll } from './PianoRoll'
import { checkAbc } from '@/lib/abc'
import { readHeaders, setHeader } from '@/lib/abc-headers'
import { abcToNotes, barLengthInSteps, writeNotesIntoAbc, type Note } from '@/lib/abc-notes'
import { CLIP_LIMITS, type ClipSource, type ClipStatus } from '@/schemas/clips-schema'

export type ClipFormValues = {
  title: string
  description: string
  tags: string
  abc: string
  /** 'ai' once the AI assistant has written the ABC. */
  source: ClipSource
}

type Props = {
  initial: ClipFormValues
  /** False until the records connection can accept writes. */
  ready: boolean
  /** Called by "Save draft" (status 'draft') and "Publish" (status 'published'). */
  onSave: (values: ClipFormValues, status: ClipStatus) => Promise<void>
}

export function ClipForm({ initial, ready, onSave }: Props) {
  const [values, setValues] = useState(initial)
  const [saving, setSaving] = useState(false)
  const check = checkAbc(values.abc)
  const canSave = ready && !saving && check.ok && values.title.trim() !== ''
  const headers = readHeaders(values.abc)

  // While the ABC text is mid-edit and doesn't parse, keep showing the last good notes.
  const lastGoodNotes = useRef<Note[]>([])
  const notes = useMemo(() => {
    if (check.ok) lastGoodNotes.current = abcToNotes(values.abc)
    return lastGoodNotes.current
  }, [values.abc, check.ok])

  function setField(field: 'description' | 'tags', value: string) {
    setValues((v) => ({ ...v, [field]: value }))
  }

  /** Every ABC change goes through here; the title follows the T: line. */
  function setAbc(abc: string) {
    setValues((v) => ({ ...v, abc, title: readHeaders(abc).title || v.title }))
  }

  function setTitle(title: string) {
    setValues((v) => ({ ...v, title, abc: setHeader(v.abc, 'T', title) }))
  }

  async function save(status: ClipStatus) {
    setSaving(true)
    try {
      await onSave({ ...values, title: values.title.trim() }, status)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <AiAssist currentAbc={values.abc} onResult={(abc) => { setAbc(abc); setValues((v) => ({ ...v, source: 'ai' })) }} />

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-64 flex-1 flex-col gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={values.title}
            maxLength={CLIP_LIMITS.title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Lo-fi chords in D minor"
          />
        </div>
        <MetadataFields
          headers={headers}
          onTempo={(bpm) => setAbc(setHeader(values.abc, 'Q', `1/4=${bpm}`))}
          // Meter and key: rewrite the music from the current notes, so the
          // bar lines move and the same pitches get re-spelled for the new key.
          onMeter={(meter) => setAbc(writeNotesIntoAbc(setHeader(values.abc, 'M', meter), notes))}
          onKey={(key) => setAbc(writeNotesIntoAbc(setHeader(values.abc, 'K', key), notes))}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Piano roll</Label>
        <PianoRoll
          notes={notes}
          barSteps={barLengthInSteps(headers.meter)}
          onChange={(next) => setAbc(writeNotesIntoAbc(values.abc, next))}
        />
        <p className="text-xs text-muted-foreground">
          Double-click to add a note, drag to move it, drag its right edge to resize, double-click a note to delete it.
          Editing here rewrites the music lines of the ABC, so chord symbols become written-out notes.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="abc">ABC notation</Label>
          <Textarea
            id="abc"
            value={values.abc}
            maxLength={CLIP_LIMITS.abc}
            onChange={(e) => setAbc(e.target.value)}
            rows={10}
            spellCheck={false}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            {values.abc.length} / {CLIP_LIMITS.abc} characters
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Sheet music</Label>
          {check.ok ? (
            <AbcView abc={values.abc} />
          ) : (
            <ul className="flex flex-col gap-1 text-sm text-destructive" data-testid="abc-error">
              {check.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={values.description}
            maxLength={CLIP_LIMITS.description}
            onChange={(e) => setField('description', e.target.value)}
            rows={3}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tags">Tags</Label>
          <Input
            id="tags"
            value={values.tags}
            maxLength={CLIP_LIMITS.tags}
            onChange={(e) => setField('tags', e.target.value)}
            placeholder="lofi, chords, d minor"
          />
          <p className="text-xs text-muted-foreground">Separate tags with commas.</p>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" disabled={!canSave} onClick={() => save('draft')}>
          Save draft
        </Button>
        <Button disabled={!canSave} onClick={() => save('published')}>
          Publish
        </Button>
      </div>
    </div>
  )
}
