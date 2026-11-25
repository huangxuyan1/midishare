/* home pattern: search-first — a search box over the grid of clip cards */
/**
 * /home - the clip library: everyone's published clips, newest first, with
 * search. Each card says who made the clip (their display name, or Anonymous).
 * Your own published clips are in the same list as everyone else's; your
 * drafts are on your own page, /me.
 * Signed-out visitors see the same library, plus a line inviting them to sign in.
 * The server also sends you your own drafts, so the status filter below keeps
 * them out of this list. It is for display, not for privacy.
 */
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AuthOverlay, useAuth, useQuery, type RecordData } from 'deepspace'
import { Music } from 'lucide-react'
import { Badge, Button, EmptyState, SearchInput } from '@/components/ui'
import { ClipCard } from '@/components/ClipCard'
import { parseTags } from '@/lib/abc'
import { useProfiles } from '@/lib/profiles'
import { LEGEND } from '@/lib/utils'
import type { Clip } from '@/schemas/clips-schema'

const GRID = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'

export default function HomePage() {
  const navigate = useNavigate()
  const { isSignedIn } = useAuth()
  const [params, setParams] = useSearchParams()
  const [showSignIn, setShowSignIn] = useState(false)
  const search = params.get('q') ?? ''
  const tag = params.get('tag') ?? ''
  const { records, status } = useQuery<Clip>('clips', { orderBy: 'createdAt', orderDir: 'desc' })
  const { nameOf } = useProfiles()

  const published = records.filter((r) => r.data.status === 'published' && matches(r, search, tag))
  const filtering = search !== '' || tag !== ''

  function setFilter(key: 'q' | 'tag', value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Clip library</h1>
        <p className="max-w-xl text-muted-foreground">
          Short musical ideas, kept as ABC text. Open one to play it, copy it, or build on it.
        </p>
      </header>

      {!isSignedIn && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-sm">Sign in to save your own clips and draft new ones with the AI.</p>
          <Button size="sm" variant="outline" onClick={() => setShowSignIn(true)}>
            Sign in
          </Button>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={LEGEND}>Published{status !== 'loading' && ` · ${published.length}`}</h2>
          <div className="w-full sm:w-80">
            <SearchInput
              value={search}
              onChange={(e) => setFilter('q', e.target.value)}
              onClear={() => setFilter('q', '')}
              placeholder="Search by title or tag"
            />
          </div>
        </div>
        {tag && (
          <p className="flex items-center gap-2 text-sm">
            Tag <Badge variant="outline">#{tag}</Badge>
            <button className="text-muted-foreground underline underline-offset-4 hover:text-foreground" onClick={() => setFilter('tag', '')}>
              clear
            </button>
          </p>
        )}
        {status === 'loading' ? (
          // Placeholders the size of a card, while the first clips load.
          <div className={GRID} aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-48 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : published.length === 0 ? (
          <EmptyState
            data-testid="no-clips"
            className="rounded-lg border border-dashed border-border"
            icon={<Music />}
            title={filtering ? 'No clips match' : 'No clips published yet'}
            description={filtering ? 'Try a shorter search, or clear the filter.' : 'Published clips show up here for everyone.'}
            action={
              filtering
                ? { label: 'Clear the filter', onClick: () => setParams({}, { replace: true }) }
                : isSignedIn
                  ? { label: 'New clip', onClick: () => navigate('/new') }
                  : undefined
            }
          />
        ) : (
          <div className={GRID}>
            {published.map((clip) => (
              <ClipCard key={clip.recordId} clip={clip} author={nameOf(clip.createdBy)} />
            ))}
          </div>
        )}
      </section>

      {showSignIn && <AuthOverlay onClose={() => setShowSignIn(false)} />}
    </div>
  )
}

/** Case-insensitive match on title or any tag; `tag` must match a tag exactly. */
function matches(clip: RecordData<Clip>, search: string, tag: string) {
  const tags = parseTags(clip.data.tags)
  if (tag && !tags.includes(tag.toLowerCase())) return false
  const q = search.trim().toLowerCase()
  if (!q) return true
  return clip.data.title.toLowerCase().includes(q) || tags.some((t) => t.includes(q))
}
