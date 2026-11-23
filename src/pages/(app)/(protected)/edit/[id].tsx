/**
 * /edit/:id - edit your own clip. The server rejects edits to other people's
 * clips (update: 'own' in the clips schema); hiding the form is only UX.
 */
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth, useMutations } from 'deepspace'
import { useToast } from '@/components/ui'
import { ClipForm, type ClipFormValues } from '@/components/ClipForm'
import { useClip } from '@/lib/clips'
import type { Clip, ClipStatus } from '@/schemas/clips-schema'

export default function EditClipPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { userId } = useAuth()
  const { error } = useToast()
  const { clip, status } = useClip(id)
  const { ready, putConfirmed } = useMutations<Clip>('clips')

  if (status === 'loading') return <p className="p-8 text-muted-foreground">Loading…</p>
  if (!clip) return <p className="p-8">Clip not found.</p>
  if (clip.createdBy !== userId) return <p className="p-8">You can only edit your own clips.</p>

  async function save(values: ClipFormValues, newStatus: ClipStatus) {
    try {
      await putConfirmed(clip!.recordId, { ...values, status: newStatus })
      navigate(`/clips/${clip!.recordId}`)
    } catch (err) {
      error('Could not save the clip', err instanceof Error ? err.message : String(err))
    }
  }

  const { title, description, tags, abc } = clip.data
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Edit clip</h1>
      <ClipForm initial={{ title, description, tags, abc }} ready={ready} onSave={save} />
    </div>
  )
}
