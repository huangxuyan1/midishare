/** /new - create a clip by pasting ABC. Sign-in required (protected folder). */
import { useNavigate } from 'react-router-dom'
import { useMutations } from 'deepspace'
import { useToast } from '@/components/ui'
import { ClipForm, type ClipFormValues } from '@/components/ClipForm'
import { EXAMPLE_ABC } from '@/lib/abc'
import type { Clip, ClipStatus } from '@/schemas/clips-schema'

const EMPTY: ClipFormValues = { title: '', description: '', tags: '', abc: EXAMPLE_ABC }

export default function NewClipPage() {
  const navigate = useNavigate()
  const { error } = useToast()
  const { ready, createConfirmed } = useMutations<Clip>('clips')

  async function save(values: ClipFormValues, status: ClipStatus) {
    try {
      // Confirmed: wait for the server to accept the write before navigating.
      const id = await createConfirmed({ ...values, status, source: 'pasted' })
      navigate(`/clips/${id}`)
    } catch (err) {
      error('Could not save the clip', err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">New clip</h1>
      <ClipForm initial={EMPTY} ready={ready} onSave={save} />
    </div>
  )
}
