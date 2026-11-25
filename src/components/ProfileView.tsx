/**
 * One person's page: their display name and their published clips.
 * Used by /u/:id (anyone's page) and /me (your own).
 *
 * On your own page you also see your drafts and a link to change your name.
 * Drafts never reach other people: the server only sends a draft to its owner.
 *
 * A person without a display name has no public page. Their clips are in the
 * library as "Anonymous", and this page doesn't gather them for other people.
 */
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, useQuery } from 'deepspace'
import { Button, EmptyState } from '@/components/ui'
import { ClipCard } from '@/components/ClipCard'
import { ANONYMOUS, useProfiles } from '@/lib/profiles'
import { LEGEND } from '@/lib/utils'
import type { Clip } from '@/schemas/clips-schema'

const GRID = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'

export function ProfileView({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const { userId: myId } = useAuth()
  const { status: profilesStatus, nameOf } = useProfiles()
  const { records, status: clipsStatus } = useQuery<Clip>('clips', { orderBy: 'createdAt', orderDir: 'desc' })

  const isMe = userId === myId
  const name = nameOf(userId)
  const theirs = records.filter((r) => r.createdBy === userId)
  const published = theirs.filter((r) => r.data.status === 'published')
  const drafts = theirs.filter((r) => r.data.status === 'draft')

  if (profilesStatus === 'loading' || clipsStatus === 'loading') {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10" aria-busy="true">
        <div className="h-9 w-72 animate-pulse rounded-md bg-muted" />
        <div className="h-48 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }

  if (!isMe && !name) {
    return (
      <EmptyState
        className="mx-auto max-w-5xl py-24"
        title="No public profile"
        description="This person publishes anonymously, or the link is wrong."
        action={{ label: 'Browse clips', onClick: () => navigate('/home') }}
      />
    )
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10">
      <header className="flex flex-col gap-2">
        <p className={LEGEND}>{isMe ? 'Your profile' : 'Profile'}</p>
        <h1 className="text-3xl font-semibold" data-testid="profile-name">
          {name ?? ANONYMOUS}
        </h1>
        {isMe && (
          <p className="max-w-xl text-sm text-muted-foreground">
            {name ? 'This name is shown on your published clips. ' : `Your published clips show as ${ANONYMOUS}. `}
            <Link to="/settings" className="underline underline-offset-4 hover:text-foreground">
              {name ? 'Change it' : 'Set a display name'}
            </Link>
          </p>
        )}
      </header>

      {isMe && theirs.length === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border px-4 py-3">
          <p className="text-sm text-muted-foreground">You have no clips yet. Start from the example, or ask the AI.</p>
          <Button size="sm" onClick={() => navigate('/new')}>
            New clip
          </Button>
        </div>
      )}

      {isMe && drafts.length > 0 && (
        <section className="flex flex-col gap-4" data-testid="profile-drafts">
          <h2 className={LEGEND}>Drafts · {drafts.length} · only you see these</h2>
          <div className={GRID}>
            {drafts.map((clip) => (
              <ClipCard key={clip.recordId} clip={clip} author={name} />
            ))}
          </div>
        </section>
      )}

      {(published.length > 0 || !isMe) && (
        <section className="flex flex-col gap-4" data-testid="profile-published">
          <h2 className={LEGEND}>Published · {published.length}</h2>
          {published.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing published yet.</p>
          ) : (
            <div className={GRID}>
              {published.map((clip) => (
                <ClipCard key={clip.recordId} clip={clip} author={name} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
