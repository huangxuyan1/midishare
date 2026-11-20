/**
 * Clips - one short piece of music stored as ABC notation.
 *
 * Ownership uses the record envelope's `createdBy`, which the server sets
 * from the caller's verified login. There is no ownerId column, so a client
 * cannot claim someone else's clip.
 *
 * Who can do what (enforced by the RecordRoom on the server, not the UI):
 * - Anyone, signed in or not, can read published clips.
 * - The owner can also read their own drafts.
 * - Signed-in users can create clips.
 * - Only the owner can edit, unpublish (status -> 'draft') or delete a clip.
 * - Admins (the app owner) can additionally delete any clip, for moderation.
 */

import type { CollectionSchema } from 'deepspace/schema'

// Size caps, enforced by the server on every create and update.
// The UI reuses them for input limits and counters.
export const CLIP_LIMITS = {
  title: 100,
  description: 1000,
  tags: 200,
  abc: 5000,
} as const

export type ClipStatus = 'draft' | 'published'
export type ClipSource = 'pasted' | 'ai'

export type Clip = {
  title: string
  description: string
  /** Comma-separated, e.g. "lofi, chords, d minor". Plain text so it can be capped. */
  tags: string
  /** The ABC notation itself. */
  abc: string
  status: ClipStatus
  source: ClipSource
}

export const clipsSchema: CollectionSchema = {
  name: 'clips',
  columns: [
    { name: 'title', storage: 'text', interpretation: 'plain', required: true, maxLength: CLIP_LIMITS.title },
    { name: 'description', storage: 'text', interpretation: 'plain', default: '', maxLength: CLIP_LIMITS.description },
    { name: 'tags', storage: 'text', interpretation: 'plain', default: '', maxLength: CLIP_LIMITS.tags },
    { name: 'abc', storage: 'text', interpretation: 'plain', required: true, maxLength: CLIP_LIMITS.abc },
    {
      name: 'status',
      storage: 'text',
      interpretation: { kind: 'select', options: ['draft', 'published'] },
      default: 'draft',
    },
    {
      name: 'source',
      storage: 'text',
      interpretation: { kind: 'select', options: ['pasted', 'ai'] },
      default: 'pasted',
    },
  ],
  // 'published' below means: the caller owns the clip, OR its status is 'published'.
  visibilityField: { field: 'status', value: 'published' },
  permissions: {
    '*': { read: 'published', create: false, update: false, delete: false },
    viewer: { read: 'published', create: false, update: false, delete: false },
    member: { read: 'published', create: true, update: 'own', delete: 'own' },
    admin: { read: 'published', create: true, update: 'own', delete: true },
  },
}
