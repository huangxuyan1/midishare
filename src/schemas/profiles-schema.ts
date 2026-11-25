/**
 * Profiles - the name a user chooses to show next to their clips.
 *
 * A profile is optional. A user without one publishes as "Anonymous": their
 * clips still carry the creator's id (`createdBy`), but nothing public maps
 * that id to a name. Account names and emails stay in the users collection,
 * which only its own user can read (see users-schema.ts).
 *
 * The profile of user X is the record whose `createdBy` is X. The server sets
 * `createdBy` from the caller's verified login, so nobody can write a profile
 * for somebody else.
 *
 * Who can do what (enforced by the RecordRoom on the server, not the UI):
 * - Anyone, signed in or not, can read every profile.
 * - Signed-in users can create a profile, and change or delete their own.
 * - Admins (the app owner) can additionally delete any profile, for moderation.
 *
 * Display names are not unique, like display names on X. Two people can pick
 * the same one; their profile pages (/u/<their id>) are still different.
 */

import type { CollectionSchema } from 'deepspace/schema'

// Size cap, enforced by the server on every create and update.
export const PROFILE_LIMITS = {
  displayName: 40,
} as const

export type Profile = {
  displayName: string
}

export const profilesSchema: CollectionSchema = {
  name: 'profiles',
  columns: [
    { name: 'displayName', storage: 'text', interpretation: 'plain', required: true, maxLength: PROFILE_LIMITS.displayName },
  ],
  permissions: {
    '*': { read: true, create: false, update: false, delete: false },
    viewer: { read: true, create: false, update: false, delete: false },
    member: { read: true, create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: 'own', delete: true },
  },
}
