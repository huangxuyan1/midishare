/**
 * /clips/:id - one clip: a read-only piano roll with play/stop, the sheet
 * music or the ABC text, Download .mid, Copy ABC.
 * Public: signed-out visitors can open published clips. The owner also gets
 * Edit, Publish/Unpublish and Delete. The server enforces who may do those
 * (update/delete: 'own'); hiding the buttons for others is only UX.
 */
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth, useMutations } from 'deepspace'
import { ArrowLeft, Copy, Download, GitFork, Pencil, Trash2 } from 'lucide-react'
import { Badge, Button, ConfirmModal, EmptyState, useToast } from '@/components/ui'
import { ClipPlayer } from '@/components/ClipPlayer'
import { downloadMidi, parseTags } from '@/lib/abc'
import { readHeaders } from '@/lib/abc-headers'
import { useClip } from '@/lib/clips'
import { LEGEND } from '@/lib/utils'
import type { Clip } from '@/schemas/clips-schema'

export default function ClipPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { userId, isSignedIn } = useAuth()
  const { success, error } = useToast()
  const { clip, status } = useClip(id)
  const { ready, putConfirmed, removeConfirmed } = useMutations<Clip>('clips')
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (status === 'loading') {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10" aria-busy="true">
        <div className="h-9 w-72 animate-pulse rounded-md bg-muted" />
        <div className="h-96 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }
  if (!clip) {
    return (
      <EmptyState
        className="mx-auto max-w-5xl py-24"
        title="Clip not found"
        description="This clip doesn't exist, or it's a draft you don't own."
        action={{ label: 'Browse clips', onClick: () => navigate('/home') }}
      />
    )
  }

  const { title, description, tags, abc, status: clipStatus, source } = clip.data
  const headers = readHeaders(abc)
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
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10">
      <Link to="/home" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All clips
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold" data-testid="clip-title">
              {title}
            </h1>
            {clipStatus === 'draft' && <Badge variant="secondary">Draft</Badge>}
            {source === 'ai' && <Badge variant="outline">AI-generated</Badge>}
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            {headers.key} · {headers.meter} · {headers.tempo} BPM · Updated {new Date(clip.updatedAt).toLocaleString()}
          </p>
          {description && <p className="max-w-2xl whitespace-pre-wrap text-sm">{description}</p>}
          {tags && (
            <div className="flex flex-wrap gap-1.5">
              {parseTags(tags).map((tag) => (
                <Link key={tag} to={`/home?tag=${encodeURIComponent(tag)}`}>
                  <Badge variant="outline" className="hover:border-primary">
                    #{tag}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* What anyone can take away from a clip. */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={copyAbc}>
            <Copy className="size-4" /> Copy ABC
          </Button>
          <Button variant="outline" onClick={() => downloadMidi(abc, title)}>
            <Download className="size-4" /> Download .mid
          </Button>
          {isSignedIn && (
            <Button variant="outline" onClick={() => navigate(`/new?from=${clip.recordId}`)}>
              <GitFork className="size-4" /> Make a variation
            </Button>
          )}
        </div>
      </header>

      <ClipPlayer abc={abc} />

      {isOwner && (
        <section className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3" data-testid="owner-actions">
          <p className={`${LEGEND} mr-auto`}>Your clip</p>
          <Button variant="outline" onClick={() => navigate(`/edit/${clip.recordId}`)}>
            <Pencil className="size-4" /> Edit
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
            <Trash2 className="size-4" /> Delete
          </Button>
        </section>
      )}

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={deleteClip}
        title={`Delete "${title}"?`}
        description="This can't be undone."
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  )
}
