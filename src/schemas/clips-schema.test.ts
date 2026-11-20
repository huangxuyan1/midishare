/**
 * Checks the clips permission rules with the SDK's own permission functions
 * (the same canRead/canUpdate/canDelete the RecordRoom runs on the server).
 * The two-user test against a running app is separate.
 */
import { describe, expect, it } from 'vitest'
import { canCreate, canDelete, canRead, canUpdate, lintSchema, ROLE_ANONYMOUS } from 'deepspace/worker'
import { clipsSchema } from './clips-schema'

const ALICE = 'user_alice'
const BOB = 'user_bob'

function clipBy(owner: string, status: 'draft' | 'published') {
  return { createdBy: owner, data: { title: 't', abc: 'X:1\nK:C\nC', status } }
}

const draft = clipBy(ALICE, 'draft')
const published = clipBy(ALICE, 'published')

describe('clips schema', () => {
  it('passes the SDK schema lint', () => {
    expect(lintSchema(clipsSchema)).toEqual([])
  })

  it('lets anyone read published clips, including signed-out visitors', () => {
    expect(canRead(clipsSchema, ROLE_ANONYMOUS, published, 'anon')).toBe(true)
    expect(canRead(clipsSchema, 'viewer', published, 'anon')).toBe(true)
    expect(canRead(clipsSchema, 'member', published, BOB)).toBe(true)
  })

  it('hides drafts from everyone except the owner', () => {
    expect(canRead(clipsSchema, 'member', draft, ALICE)).toBe(true)
    expect(canRead(clipsSchema, 'member', draft, BOB)).toBe(false)
    expect(canRead(clipsSchema, 'viewer', draft, 'anon')).toBe(false)
    expect(canRead(clipsSchema, ROLE_ANONYMOUS, draft, 'anon')).toBe(false)
    // Admins don't get to see other people's drafts either.
    expect(canRead(clipsSchema, 'admin', draft, BOB)).toBe(false)
  })

  it('lets only signed-in users create clips', () => {
    expect(canCreate(clipsSchema, 'member')).toBe(true)
    expect(canCreate(clipsSchema, 'viewer')).toBe(false)
    expect(canCreate(clipsSchema, ROLE_ANONYMOUS)).toBe(false)
  })

  it('lets only the owner edit or unpublish', () => {
    expect(canUpdate(clipsSchema, 'member', published, ALICE)).toBe(true)
    expect(canUpdate(clipsSchema, 'member', published, BOB)).toBe(false)
    expect(canUpdate(clipsSchema, 'admin', published, BOB)).toBe(false)
    expect(canUpdate(clipsSchema, 'viewer', published, 'anon')).toBe(false)
  })

  it('lets the owner delete, plus admins for moderation', () => {
    expect(canDelete(clipsSchema, 'member', published, ALICE)).toBe(true)
    expect(canDelete(clipsSchema, 'member', published, BOB)).toBe(false)
    expect(canDelete(clipsSchema, 'admin', published, BOB)).toBe(true)
    expect(canDelete(clipsSchema, 'viewer', published, 'anon')).toBe(false)
  })
})
