/**
 * Checks the profiles permission rules, and that the users collection stays
 * private, with the SDK's own permission functions (the ones the RecordRoom
 * runs on the server). The two-user test against a running app is separate.
 */
import { describe, expect, it } from 'vitest'
import { canCreate, canDelete, canRead, canUpdate, lintSchema, ROLE_ANONYMOUS } from 'deepspace/worker'
import { profilesSchema } from './profiles-schema'
import { usersSchema } from './users-schema'

const ALICE = 'user_alice'
const BOB = 'user_bob'

const alicesProfile = { createdBy: ALICE, data: { displayName: 'Alice' } }

describe('profiles schema', () => {
  it('passes the SDK schema lint', () => {
    expect(lintSchema(profilesSchema)).toEqual([])
  })

  it('lets anyone read a profile, including signed-out visitors', () => {
    expect(canRead(profilesSchema, ROLE_ANONYMOUS, alicesProfile, 'anon')).toBe(true)
    expect(canRead(profilesSchema, 'viewer', alicesProfile, 'anon')).toBe(true)
    expect(canRead(profilesSchema, 'member', alicesProfile, BOB)).toBe(true)
  })

  it('lets only signed-in users create a profile', () => {
    expect(canCreate(profilesSchema, 'member')).toBe(true)
    expect(canCreate(profilesSchema, 'viewer')).toBe(false)
    expect(canCreate(profilesSchema, ROLE_ANONYMOUS)).toBe(false)
  })

  it('lets only the owner change the name', () => {
    expect(canUpdate(profilesSchema, 'member', alicesProfile, ALICE)).toBe(true)
    expect(canUpdate(profilesSchema, 'member', alicesProfile, BOB)).toBe(false)
    expect(canUpdate(profilesSchema, 'admin', alicesProfile, BOB)).toBe(false)
    expect(canUpdate(profilesSchema, ROLE_ANONYMOUS, alicesProfile, 'anon')).toBe(false)
  })

  it('lets the owner delete their profile, plus admins for moderation', () => {
    expect(canDelete(profilesSchema, 'member', alicesProfile, ALICE)).toBe(true)
    expect(canDelete(profilesSchema, 'member', alicesProfile, BOB)).toBe(false)
    expect(canDelete(profilesSchema, 'admin', alicesProfile, BOB)).toBe(true)
  })
})

describe('users schema', () => {
  const alicesAccount = { recordId: ALICE, createdBy: ALICE, data: { name: 'Alice Real-Name', email: 'alice@example.com' } }

  it('lets a user read only their own account row', () => {
    expect(canRead(usersSchema, 'member', alicesAccount, ALICE)).toBe(true)
    expect(canRead(usersSchema, 'member', alicesAccount, BOB)).toBe(false)
    expect(canRead(usersSchema, ROLE_ANONYMOUS, alicesAccount, 'anon')).toBe(false)
  })

  it('limits the list of users sent to each browser the same way', () => {
    expect(usersSchema.roster).toBe('read-policy')
  })
})
