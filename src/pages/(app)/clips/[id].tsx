/**
 * /clips/:id - one clip: a read-only piano roll with play/stop, the sheet
 * music, Download .mid, Copy ABC.
 * Public: signed-out visitors can open published clips. The owner also gets
 * Edit, Publish/Unpublish and Delete. The server enforces who may do those
 * (update/delete: 'own'); hiding the buttons for others is only UX.
 */
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth, useMutations } from 'deepspace'
import { Copy, Download, Sparkles } from 'lucide-react'
import { Badge, Button, ConfirmModal, useToast } from '@/components/ui'
import { ClipPlayer } from '@/components/ClipPlayer'
import { downloadMidi, parseTags } from '@/lib/abc'
import { useClip } from '@/lib/clips'
import type { Clip } from '@/schemas/clips-schema'

export default function ClipPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { userId, isSignedIn } = useAuth()
  const { success, error } = useToast()
  const { clip, status } = useClip(id)
  const { ready, putConfirmed, removeConfirmed } = useMutations<Clip>('clips')
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (status === 'loading') return <p className="p-8 text-muted-foreground">Loading…</p>
  if (!clip) {
    return (
      <div className="p-8">
        <p>This clip doesn't exist, or it's a draft you don't own.</p>
        <Link to="/home" className="text-sm underline">
          Browse clips
        </Link>
      </div>
    )
  }

  const { title, description, tags, abc, status: clipStatus, source } = clip.data
  const isOwner = clip.createdBy === userId

  async function copyAbc() {
    await navigator.clipboard.writeText(abc)
    success('Copied', 'The ABC is on your clipboard.')
  }

  async function setStatus(next: 'draft' | 'published') {
    try {
      await putConfirmed(clip!.recordId, { status: next })
    } catch (err) {
      error('Could not update the clip', err instanceof Error ? err.message : String(err))
    }
  }

  async function deleteClip() {
    try {
      await removeConfirmed(clip!.recordId)
      navigate('/home')
    } catch (err) {
      error('Could not delete the clip', err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold" data-testid="clip-title">
            {title}
          </h1>
          {clipStatus === 'draft' && <Badge variant="secondary">Draft</Badge>}
          {source === 'ai' && <Badge variant="outline">AI-generated</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          Updated {new Date(clip.updatedAt).toLocaleString()}
        </p>
        {description && <p className="whitespace-pre-wrap text-sm">{description}</p>}
        {tags && (
          <div className="flex flex-wrap gap-1.5">
            {parseTags(tags).map((tag) => (
              <Link key={tag} to={`/home?tag=${encodeURIComponent(tag)}`}>
                <Badge variant="outline">#{tag}</Badge>
              </Link>
            ))}
          </div>
        )}
      </div>

      <ClipPlayer abc={abc} />

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => downloadMidi(abc, title)}>
          <Download className="size-4" /> Download .mid
        </Button>
        <Button variant="outline" onClick={copyAbc}>
          <Copy className="size-4" /> Copy ABC
        </Button>
        {isSignedIn && (
          <Button variant="outline" onClick={() => navigate(`/new?from=${clip.recordId}`)}>
            <Sparkles className="size-4" /> Make a variation
          </Button>
        )}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Show ABC</summary>
        <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">{abc}</pre>
      </details>

      {isOwner && (
        <div className="flex flex-wrap gap-3 border-t border-border pt-4" data-testid="owner-actions">
          <Button variant="outline" onClick={() => navigate(`/edit/${clip.recordId}`)}>
            Edit
          </Button>
          {clipStatus === 'draft' ? (
            <Button disabled={!ready} onClick={() => setStatus('published')}>
              Publish
            </Button>
          ) : (
            <Button variant="outline" disabled={!ready} onClick={() => setStatus('draft')}>
              Unpublish
            </Button>
          )}
          <Button variant="destructive" disabled={!ready} onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        </div>
      )}

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={deleteClip}
        title="Delete this clip?"
        description="This can't be undone."
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  )
}
