/**
 * /home - browse and search published clips, newest first.
 * Signed-in users also see their own clips (including drafts) in "My clips".
 * The server only sends what the caller may read, so filtering here is just
 * for display, not for privacy.
 */
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth, useQuery, type RecordData } from 'deepspace'
import { Badge, Button, SearchInput } from '@/components/ui'
import { parseTags } from '@/lib/abc'
import type { Clip } from '@/schemas/clips-schema'

export default function HomePage() {
  const navigate = useNavigate()
  const { userId, isSignedIn } = useAuth()
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const tag = params.get('tag') ?? ''
  const { records, status } = useQuery<Clip>('clips', { orderBy: 'createdAt', orderDir: 'desc' })

  const myClips = records.filter((r) => r.createdBy === userId)
  const published = records.filter((r) => r.data.status === 'published' && matches(r, search, tag))

  function setFilter(key: 'q' | 'tag', value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Clips</h1>
          <p className="text-sm text-muted-foreground">Short musical ideas in ABC notation. Play, download, copy.</p>
        </div>
        {isSignedIn && <Button onClick={() => navigate('/new')}>New clip</Button>}
      </div>

      {isSignedIn && myClips.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">My clips</h2>
          <ClipList clips={myClips} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Published</h2>
        <SearchInput
          value={search}
          onChange={(e) => setFilter('q', e.target.value)}
          onClear={() => setFilter('q', '')}
          placeholder="Search by title or tag"
        />
        {tag && (
          <p className="text-sm">
            Tag <Badge variant="outline">#{tag}</Badge>{' '}
            <button className="text-muted-foreground underline" onClick={() => setFilter('tag', '')}>
              clear
            </button>
          </p>
        )}
        {status === 'loading' ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : published.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="no-clips">
            {search || tag ? 'No clips match.' : 'No clips published yet.'}
          </p>
        ) : (
          <ClipList clips={published} />
        )}
      </section>
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

function ClipList({ clips }: { clips: RecordData<Clip>[] }) {
  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {clips.map((clip) => (
        <li key={clip.recordId}>
          <Link
            to={`/clips/${clip.recordId}`}
            className="flex flex-wrap items-center gap-2 px-4 py-3 hover:bg-accent"
            data-testid="clip-row"
          >
            <span className="font-medium">{clip.data.title}</span>
            {clip.data.status === 'draft' && <Badge variant="secondary">Draft</Badge>}
            <span className="ml-auto flex flex-wrap gap-1">
              {parseTags(clip.data.tags).map((t) => (
                <Badge key={t} variant="outline">
                  #{t}
                </Badge>
              ))}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
