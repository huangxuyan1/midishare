/**
 * /new - create a clip. Sign-in required (protected folder).
 * /new?from=<clipId> starts from another clip's ABC ("Make a variation").
 */
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutations } from 'deepspace'
import { useToast } from '@/components/ui'
import { ClipForm, type ClipFormValues } from '@/components/ClipForm'
import { EXAMPLE_ABC } from '@/lib/abc'
import { useClip } from '@/lib/clips'
import type { Clip, ClipStatus } from '@/schemas/clips-schema'

export default function NewClipPage() {
  const navigate = useNavigate()
  const { error } = useToast()
  const { ready, createConfirmed } = useMutations<Clip>('clips')
  const fromId = useSearchParams()[0].get('from') ?? undefined
  const { clip: from, status } = useClip(fromId)

  async function save(values: ClipFormValues, status: ClipStatus) {
    try {
      // Confirmed: wait for the server to accept the write before navigating.
      const id = await createConfirmed({ ...values, status })
      navigate(`/clips/${id}`)
    } catch (err) {
      error('Could not save the clip', err instanceof Error ? err.message : String(err))
    }
  }

  if (fromId && status === 'loading') return <p className="p-8 text-muted-foreground">Loading…</p>

  const initial: ClipFormValues = from
    ? { title: `${from.data.title} (variation)`, description: '', tags: from.data.tags, abc: from.data.abc, source: 'pasted' }
    : { title: '', description: '', tags: '', abc: EXAMPLE_ABC, source: 'pasted' }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">{from ? 'New variation' : 'New clip'}</h1>
      {/* The key starts a fresh form when the page switches between a variation and a blank clip. */}
      <ClipForm key={fromId ?? 'blank'} initial={initial} ready={ready} onSave={save} />
    </div>
  )
}
