/**
 * The clip form, shared by the create page and the edit page.
 * Paste ABC on the left, see the notation and play it on the right.
 * Saving is disabled until the ABC parses.
 */
import { useState } from 'react'
import { Button, Input, Label, Textarea } from '@/components/ui'
import { AbcView } from './AbcView'
import { AiAssist } from './AiAssist'
import { checkAbc } from '@/lib/abc'
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

  function set(field: 'title' | 'description' | 'tags' | 'abc', value: string) {
    setValues((v) => ({ ...v, [field]: value }))
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
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <AiAssist
          currentAbc={values.abc}
          onResult={(abc) => setValues((v) => ({ ...v, abc, source: 'ai' }))}
        />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={values.title}
            maxLength={CLIP_LIMITS.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Lo-fi chords in D minor"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="abc">ABC notation</Label>
          <Textarea
            id="abc"
            value={values.abc}
            maxLength={CLIP_LIMITS.abc}
            onChange={(e) => set('abc', e.target.value)}
            rows={10}
            spellCheck={false}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            {values.abc.length} / {CLIP_LIMITS.abc} characters
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={values.description}
            maxLength={CLIP_LIMITS.description}
            onChange={(e) => set('description', e.target.value)}
            rows={3}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tags">Tags</Label>
          <Input
            id="tags"
            value={values.tags}
            maxLength={CLIP_LIMITS.tags}
            onChange={(e) => set('tags', e.target.value)}
            placeholder="lofi, chords, d minor"
          />
          <p className="text-xs text-muted-foreground">Separate tags with commas.</p>
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

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Preview</h2>
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
  )
}
