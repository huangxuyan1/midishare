/**
 * The clip editor, shared by the create page and the edit page.
 *
 * The ABC text is the single source of truth. Everything else is a view of it
 * that writes back to it:
 * - the piano roll shows abcToNotes(abc); a roll edit rewrites the music lines
 * - title, tempo, meter and key show the header lines; editing one rewrites
 *   that header (meter and key also rewrite the music so the notes stay put)
 * - the sheet music preview renders the ABC
 * - the transport above the roll plays it, with a playhead on the roll
 * Saving is disabled until the ABC parses and the clip has a title.
 *
 * Undo/redo: the form's values live in a history (see lib/history.ts), and
 * every change goes through change(), so any change can be undone.
 *
 * Layout: one panel with the settings, the transport and the roll; below it
 * the ABC text, the sheet music, the AI box and the details; and a save bar
 * that stays at the bottom of the window.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Redo2, Undo2 } from 'lucide-react'
import { Button, Input, Label, Textarea } from '@/components/ui'
import { AbcView } from './AbcView'
import { AiAssist } from './AiAssist'
import { MetadataFields } from './MetadataFields'
import { PianoRoll } from './PianoRoll'
import { Tip } from './Tip'
import { Transport } from './Transport'
import { usePlayback } from '@/lib/use-playback'
import { checkAbc, VOICES_OUT_OF_STEP } from '@/lib/abc'
import { lineUpVoices } from '@/lib/abc-voices'
import { readHeaders, setHeader } from '@/lib/abc-headers'
import { abcToNotes, barLengthInSteps, writeNotesIntoAbc, type Note } from '@/lib/abc-notes'
import { pushStep, redo, replacePresent, startHistory, undo } from '@/lib/history'
import { LEGEND } from '@/lib/utils'
import { CLIP_LIMITS, type ClipSource, type ClipStatus } from '@/schemas/clips-schema'

/** Keystrokes closer together than this count as one undo step. */
const TYPING_PAUSE_MS = 1000

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
  const [history, setHistory] = useState(() => startHistory(initial))
  const values = history.present
  const lastTypedAt = useRef(0) // time of the last keystroke; 0 when the last change wasn't typing
  const [saving, setSaving] = useState<ClipStatus | null>(null) // which save button is busy
  const check = checkAbc(values.abc)
  const canSave = ready && saving === null && check.ok && values.title.trim() !== ''
  // Voices that are out of step get a one-click fix, offered only when the rewrite passes the check.
  const outOfStep = !check.ok && check.errors.includes(VOICES_OUT_OF_STEP)
  const linedUp = outOfStep ? lineUpVoices(values.abc) : null
  const canLineUp = linedUp !== null && checkAbc(linedUp).ok
  const headers = readHeaders(values.abc)
  const barSteps = barLengthInSteps(headers.meter)
  const playback = usePlayback(values.abc, barSteps)

  // While the ABC text is mid-edit and doesn't parse, keep showing the last good notes.
  const lastGoodNotes = useRef<Note[]>([])
  const notes = useMemo(() => {
    if (check.ok) lastGoodNotes.current = abcToNotes(values.abc)
    return lastGoodNotes.current
  }, [values.abc, check.ok])

  /**
   * Every change to the form goes through here.
   * A roll edit, a dropdown or an AI result is one undo step. Typing is one
   * step per burst: the first keystroke adds a step, and keystrokes that
   * follow within a second only replace the present value.
   */
  function change(update: (v: ClipFormValues) => ClipFormValues, typing = false) {
    const now = Date.now()
    const sameBurst = typing && now - lastTypedAt.current < TYPING_PAUSE_MS
    lastTypedAt.current = typing ? now : 0
    setHistory((h) => (sameBurst ? replacePresent(h, update(h.present)) : pushStep(h, update(h.present))))
  }

  function undoStep() {
    lastTypedAt.current = 0 // typing after an undo starts a new step
    setHistory(undo)
  }

  function redoStep() {
    lastTypedAt.current = 0
    setHistory(redo)
  }

  // Ctrl+Z undoes; Ctrl+Y or Ctrl+Shift+Z redoes (Cmd on a Mac).
  // The listener is added once. That is safe because undoStep and redoStep
  // only use a ref and a state setter, which never change.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return
      // The AI prompt is not part of the clip, so it keeps the browser's own undo.
      if (e.target instanceof HTMLElement && e.target.closest('[data-native-undo]')) return
      const key = e.key.toLowerCase()
      const isUndo = key === 'z' && !e.shiftKey
      const isRedo = key === 'y' || (key === 'z' && e.shiftKey)
      if (!isUndo && !isRedo) return
      e.preventDefault() // otherwise a text field also runs its own undo
      if (isUndo) undoStep()
      else redoStep()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function setField(field: 'description' | 'tags', value: string) {
    change((v) => ({ ...v, [field]: value }), true)
  }

  /** Every ABC change goes through here; the title follows the T: line. */
  function setAbc(abc: string, typing = false) {
    change((v) => withAbc(v, abc), typing)
  }

  function setTitle(title: string) {
    change((v) => ({ ...v, title, abc: setHeader(v.abc, 'T', title) }), true)
  }

  async function save(status: ClipStatus) {
    setSaving(status)
    try {
      await onSave({ ...values, title: values.title.trim() }, status)
    } finally {
      setSaving(null)
    }
  }

  // Shown next to the save buttons: what is missing, or a summary of the clip.
  const saveHint = !check.ok
    ? 'Fix the ABC to save.'
    : values.title.trim() === ''
      ? 'Add a title to save.'
      : `${notes.length} notes · ${headers.key} · ${headers.meter} · ${headers.tempo} BPM`

  return (
    <div className="flex flex-col gap-6">
      {/* The workspace: the clip's settings, the transport and the piano roll in one panel. */}
      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-end gap-4 border-b border-border p-4">
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
            onTempo={(bpm) => setAbc(setHeader(values.abc, 'Q', `1/4=${bpm}`), true)}
            // Meter and key: rewrite the music from the current notes, so the
            // bar lines move and the same pitches get re-spelled for the new key.
            onMeter={(meter) => setAbc(writeNotesIntoAbc(setHeader(values.abc, 'M', meter), notes))}
            onKey={(key) => setAbc(writeNotesIntoAbc(setHeader(values.abc, 'K', key), notes))}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
          <div className="flex items-center gap-1">
            <Tip text="Undo (Ctrl+Z)">
              <Button size="sm" variant="ghost" onClick={undoStep} disabled={history.past.length === 0} data-testid="undo">
                <Undo2 className="size-4" /> Undo
              </Button>
            </Tip>
            <Tip text="Redo (Ctrl+Y)">
              <Button size="sm" variant="ghost" onClick={redoStep} disabled={history.future.length === 0} data-testid="redo">
                <Redo2 className="size-4" /> Redo
              </Button>
            </Tip>
          </div>
          <Transport
            status={playback.status}
            position={playback.position}
            barSteps={barSteps}
            onPlay={playback.play}
            onStop={playback.stop}
            onReset={playback.reset}
          />
        </div>

        <PianoRoll
          className="h-[26rem]"
          notes={notes}
          barSteps={barSteps}
          onChange={(next) => setAbc(writeNotesIntoAbc(values.abc, next))}
          playhead={playback.position}
          playing={playback.status === 'playing'}
        />
        <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          Double-click to add a note, drag to move it, drag its right edge to resize, double-click a note to delete it.
          Editing here rewrites the music lines of the ABC, so chord symbols become written-out notes.
        </p>
      </section>

      {/* The same clip as text and as sheet music, then the AI box and the details. */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="flex flex-col gap-2">
          <Label htmlFor="abc" className={LEGEND}>
            ABC notation
          </Label>
          <Textarea
            id="abc"
            value={values.abc}
            maxLength={CLIP_LIMITS.abc}
            onChange={(e) => setAbc(e.target.value, true)}
            rows={12}
            spellCheck={false}
            className="bg-roll font-mono text-sm leading-relaxed"
          />
          <p className="font-mono text-xs text-muted-foreground">
            {values.abc.length} / {CLIP_LIMITS.abc} characters
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <p className={LEGEND}>Sheet music</p>
          {check.ok ? (
            <AbcView abc={values.abc} />
          ) : (
            <ul
              className="flex flex-col gap-1 rounded-md border border-destructive/40 bg-card p-3 text-sm text-destructive"
              data-testid="abc-error"
            >
              {check.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
              {canLineUp && (
                <li>
                  <Button size="sm" variant="outline" onClick={() => setAbc(linedUp)} data-testid="line-up-voices">
                    Line up voices
                  </Button>
                </li>
              )}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-6">
          <AiAssist currentAbc={values.abc} onResult={(abc) => change((v) => ({ ...withAbc(v, abc), source: 'ai' }))} />

          <section className="flex flex-col gap-4">
            <p className={LEGEND}>Details</p>
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
          </section>
        </div>
      </div>

      {/* The save bar stays at the bottom of the window while the page scrolls. */}
      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-border bg-background px-4 py-3">
        <p className="mr-auto font-mono text-xs text-muted-foreground" data-testid="save-hint">
          {saveHint}
        </p>
        <Button variant="outline" disabled={!canSave} loading={saving === 'draft'} onClick={() => save('draft')}>
          Save draft
        </Button>
        <Button disabled={!canSave} loading={saving === 'published'} onClick={() => save('published')}>
          Publish
        </Button>
      </div>
    </div>
  )
}

/** The values with new ABC. The title follows the T: line when there is one. */
function withAbc(values: ClipFormValues, abc: string): ClipFormValues {
  return { ...values, abc, title: readHeaders(abc).title || values.title }
}
