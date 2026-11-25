import { useQuery, type RecordData } from 'deepspace'
import type { Profile } from '@/schemas/profiles-schema'

/** What a clip shows when its creator has no profile. */
export const ANONYMOUS = 'Anonymous'

/**
 * Loads every public profile and looks them up by user id.
 * The profile of a user is the record that user created (`createdBy`).
 * `nameOf` returns null for a user who has no profile: they are anonymous.
 */
export function useProfiles() {
  // Oldest first: if a user ever has two profiles, the first one counts.
  const { records, status } = useQuery<Profile>('profiles', { orderBy: 'createdAt', orderDir: 'asc' })

  const byUser = new Map<string, RecordData<Profile>>()
  for (const record of records) {
    if (!byUser.has(record.createdBy)) byUser.set(record.createdBy, record)
  }

  function profileOf(userId: string | null | undefined) {
    return userId ? byUser.get(userId) : undefined
  }

  function nameOf(userId: string | null | undefined) {
    const name = profileOf(userId)?.data.displayName.trim()
    return name ? name : null
  }

  return { status, profileOf, nameOf }
}
