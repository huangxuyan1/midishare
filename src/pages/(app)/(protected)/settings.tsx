/**
 * /settings - the name you show on your clips, and your account.
 * No auth logic lives here: (protected)/_layout.tsx already wraps the page
 * in <AuthGate>.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { signOut, useAuth, useMutations, useUser } from 'deepspace'
import { Button, Input, Label, useToast } from '@/components/ui'
import { ANONYMOUS, useProfiles } from '@/lib/profiles'
import { LEGEND } from '@/lib/utils'
import { PROFILE_LIMITS, type Profile } from '@/schemas/profiles-schema'

export default function SettingsPage() {
  const { user } = useUser()

  return (
    // No background on page wrappers — pages render into whatever the app's
    // (app)/_layout provides (a plain background, or a raised panel), so they
    // stay transparent and inherit it.
    <div className="min-h-full text-foreground">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
        <h1 className="text-3xl font-semibold">Settings</h1>

        <PublicProfile />

        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className={`${LEGEND} mb-4`}>Your account</h2>

          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="text-foreground">{user?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="text-foreground">{user?.email ?? '—'}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-muted-foreground">
            Only you and the site's admin can see your account name and email.
          </p>

          <Button variant="secondary" className="mt-6" onClick={() => signOut()}>
            Sign out
          </Button>
        </section>
      </div>
    </div>
  )
}

/**
 * The display name: the one thing about you that other people see.
 * Saving a name creates or updates your profile record; saving an empty
 * field deletes it, and your clips show as Anonymous again.
 */
function PublicProfile() {
  const { userId } = useAuth()
  const { success, error } = useToast()
  const { status, profileOf } = useProfiles()
  const { ready, createConfirmed, putConfirmed, removeConfirmed } = useMutations<Profile>('profiles')

  const mine = profileOf(userId)
  const saved = mine?.data.displayName ?? ''
  // null until the user types, so the field shows the saved name once it loads.
  const [typed, setTyped] = useState<string | null>(null)
  const value = typed ?? saved
  const next = value.trim()

  async function save(event: React.FormEvent) {
    event.preventDefault()
    try {
      if (next === '') {
        if (mine) await removeConfirmed(mine.recordId)
        success('Name removed', `Your clips now show as ${ANONYMOUS}.`)
      } else {
        if (mine) await putConfirmed(mine.recordId, { displayName: next })
        else await createConfirmed({ displayName: next })
        success('Name saved', `Your clips now show "by ${next}".`)
      }
      setTyped(null)
    } catch (err) {
      error('Could not save the name', err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <h2 className={`${LEGEND} mb-4`}>Public profile</h2>

      <form onSubmit={save} className="flex flex-col gap-3">
        <Label htmlFor="display-name">Display name</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="display-name"
            className="max-w-xs"
            value={value}
            onChange={(e) => setTyped(e.target.value)}
            maxLength={PROFILE_LIMITS.displayName}
            placeholder={ANONYMOUS}
            autoComplete="off"
            disabled={status === 'loading'}
          />
          <Button type="submit" disabled={!ready || status === 'loading' || next === saved}>
            Save
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Shown next to your published clips and on{' '}
          <Link to="/me" className="underline underline-offset-4 hover:text-foreground">
            your profile
          </Link>
          . Leave it empty to publish as {ANONYMOUS}.
        </p>
      </form>
    </section>
  )
}
