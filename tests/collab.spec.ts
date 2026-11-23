/**
 * Multi-user spec. Two users sign in into separate browser contexts; the app
 * tells them apart, and one user cannot read the other's drafts or edit,
 * unpublish or delete the other's clips.
 *
 * `users(2)` takes any two accounts from your pool, so this spec passes on a
 * fresh app with no setup beyond having two test accounts:
 *   npx deepspace test accounts list
 *   npx deepspace test accounts create --email a@deepspace.test --name "A" --password-stdin
 *
 * Ask for accounts *by name* (`users(['Alice', 'Bob'])`) only when the
 * behaviour under test depends on which identity acts — otherwise naming them
 * couples the spec to one machine's pool.
 *
 * The `users` fixture handles sign-in caching (per-account storageState
 * persisted to `~/.deepspace/playwright-states/`), context creation, and
 * cleanup. No need to manage browser contexts manually.
 */
import { test, expect, loadAllTestAccounts, type MultiplayerUser } from 'deepspace/testing'

// A machine that has never created test accounts is the normal state of a
// fresh checkout, and there `users()` throws — turning "you have no pool yet"
// into three red tests about the app, which it is not. Skip the file instead
// and say what creates the pool. The count is of accounts usable HERE: the
// pool is global per developer, but passwords live only on the machine that
// created the account.
const usableTestAccounts = loadAllTestAccounts().length
test.skip(
  usableTestAccounts < 2,
  `Needs 2 usable test accounts, found ${usableTestAccounts}. Create them with ` +
    '`npx deepspace test accounts create --email <name>@deepspace.test --name "<name>" ' +
    '--password-stdin`, or fetch existing pool accounts with `npx deepspace test accounts recover --all`.',
)

test('each browser renders its own signed-in account', async ({ users }) => {
  const [a, b] = await users(2)

  // /home is dynamic (under src/pages/(app)/), so it mounts the nav shell;
  // '/' is the static landing and has no navigation.
  await Promise.all([a.page.goto('/home'), b.page.goto('/home')])

  // Email, not name. The page renders the *session's* `name || email`, while
  // `user.name` here comes from the LOCAL account registry — and the two are
  // not the same fact: a display name is optional, and an account recovered on
  // another machine has none stored locally at all. The email is the credential
  // the context signed in with, so it is the one identity both sides agree on,
  // and asserting it proves the page is showing THIS browser's account.
  // The two accounts are distinct, so two exact matches is also the proof that
  // the contexts are not sharing one session.
  for (const user of [a, b]) {
    await expect(user.page.getByTestId('app-navigation')).toBeVisible({ timeout: 15_000 })

    // The identity chip shows `name || email`. Its text is not predictable, but
    // its presence is: something must be there once the profile has loaded.
    // (It is `hidden sm:inline` in some templates, so assert text, not
    // visibility.)
    await expect(user.page.getByTestId('nav-user-name')).toHaveText(/\S/, { timeout: 15_000 })

    await user.page.getByRole('button', { name: 'Account menu' }).click()
    await expect(user.page.getByTestId('nav-user-email')).toHaveText(user.email, {
      timeout: 15_000,
    })
  }
})

// ── Clip ownership: user A owns the clips, user B is someone else ────────────

const EXAMPLE_ABC = 'X:1\nT:Ownership test\nM:4/4\nL:1/4\nK:C\nC D E F|\n'

/**
 * Calls one of the app's record tools over HTTP as `user`, without the UI.
 * The route runs the call in the RecordRoom with that user's identity, so a
 * refusal here comes from the server's permission check, not from a hidden
 * button. Reply: { ok: true, result } or { ok: false, code, error }.
 */
async function callTool(user: MultiplayerUser, tool: string, input: Record<string, unknown>) {
  const api = user.context.request // shares this user's sign-in cookies
  const { token } = await (await api.post('/api/auth/token')).json()
  const res = await api.post(`/_deepspace/agent/browser/tools/${tool}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { input },
  })
  return (await res.json()) as { ok: boolean; result?: any; error?: string }
}

/** The clip's fields as `user` reads them from the server. */
async function readClip(user: MultiplayerUser, recordId: string) {
  const reply = await callTool(user, 'records_get', { collection: 'clips', recordId })
  expect(reply.ok, reply.error).toBe(true)
  return reply.result.data.record.data
}

test("another user cannot see A's draft, or edit or delete A's clips", async ({ users }) => {
  const [a, b] = await users(2)

  // A signed-in visit creates each user's row in the app (their membership).
  for (const user of [a, b]) {
    await user.page.goto('/home')
    await expect(user.page.getByTestId('nav-user-name')).toHaveText(/\S/, { timeout: 15_000 })
  }

  const stamp = Date.now()
  const draftId = `test-draft-${stamp}`
  const publishedId = `test-published-${stamp}`
  const draftTitle = `__test-${stamp}__ draft`
  const publishedTitle = `__test-${stamp}__ published`

  try {
    // A creates one draft and one published clip.
    for (const [recordId, title, status] of [
      [draftId, draftTitle, 'draft'],
      [publishedId, publishedTitle, 'published'],
    ]) {
      const created = await callTool(a, 'records_create', {
        collection: 'clips',
        recordId,
        data: { title, abc: EXAMPLE_ABC, status },
      })
      expect(created.ok, created.error).toBe(true)
    }

    // ── Server: what B's direct calls can do ──
    // B can read the published clip but not the draft.
    expect((await readClip(b, publishedId)).title).toBe(publishedTitle)
    const draftRead = await callTool(b, 'records_get', { collection: 'clips', recordId: draftId })
    expect(draftRead.ok).toBe(false)
    expect(draftRead.error).toContain('READ DENIED')
    const listed = await callTool(b, 'records_query', { collection: 'clips' })
    const listedIds = listed.result.data.records.map((r: { recordId: string }) => r.recordId)
    expect(listedIds).toContain(publishedId)
    expect(listedIds).not.toContain(draftId)

    // B's edits and deletes are refused, for the published clip and the draft.
    for (const recordId of [publishedId, draftId]) {
      const edit = await callTool(b, 'records_update', {
        collection: 'clips',
        recordId,
        data: { title: 'changed by B' },
      })
      expect(edit.ok).toBe(false)
      expect(edit.error).toContain('UPDATE DENIED')
      const remove = await callTool(b, 'records_delete', { collection: 'clips', recordId })
      expect(remove.ok).toBe(false)
      expect(remove.error).toContain('DELETE DENIED')
    }
    // B cannot unpublish A's clip either (that is an update of `status`).
    const unpublish = await callTool(b, 'records_update', {
      collection: 'clips',
      recordId: publishedId,
      data: { status: 'draft' },
    })
    expect(unpublish.ok).toBe(false)
    expect(unpublish.error).toContain('UPDATE DENIED')

    // Both clips are still there, unchanged, as A sees them.
    expect(await readClip(a, draftId)).toMatchObject({ title: draftTitle, status: 'draft' })
    expect(await readClip(a, publishedId)).toMatchObject({ title: publishedTitle, status: 'published' })

    // ── UI: what B's pages show ──
    await b.page.goto(`/clips/${publishedId}`)
    await expect(b.page.getByTestId('clip-title')).toHaveText(publishedTitle, { timeout: 15_000 })
    await expect(b.page.getByTestId('owner-actions')).toHaveCount(0)

    await b.page.goto(`/clips/${draftId}`)
    await expect(b.page.getByText("it's a draft you don't own")).toBeVisible({ timeout: 15_000 })

    await b.page.goto(`/edit/${publishedId}`)
    await expect(b.page.getByText('You can only edit your own clips.')).toBeVisible({ timeout: 15_000 })

    await b.page.goto('/home')
    await expect(b.page.getByText(publishedTitle)).toBeVisible({ timeout: 15_000 })
    await expect(b.page.getByText(draftTitle)).toHaveCount(0)

    // A, the owner, does get the owner actions, and sees the draft.
    await a.page.goto(`/clips/${draftId}`)
    await expect(a.page.getByTestId('clip-title')).toHaveText(draftTitle, { timeout: 15_000 })
    await expect(a.page.getByTestId('owner-actions')).toBeVisible()
  } finally {
    // Clean up as the owner, whatever happened above.
    for (const recordId of [draftId, publishedId]) {
      await callTool(a, 'records_delete', { collection: 'clips', recordId }).catch(() => {})
    }
  }
})

test('the clip page shows a read-only piano roll with a transport', async ({ users }) => {
  const [a] = await users(1)
  await a.page.goto('/home')
  await expect(a.page.getByTestId('nav-user-name')).toHaveText(/\S/, { timeout: 15_000 })

  const recordId = `test-roll-${Date.now()}`
  try {
    const created = await callTool(a, 'records_create', {
      collection: 'clips',
      recordId,
      data: { title: `__test-${Date.now()}__ roll`, abc: EXAMPLE_ABC, status: 'published' },
    })
    expect(created.ok, created.error).toBe(true)

    await a.page.goto(`/clips/${recordId}`)
    const roll = a.page.getByTestId('piano-roll')
    await expect(roll).toBeVisible({ timeout: 15_000 })
    await expect(a.page.getByTestId('transport')).toBeVisible()
    await expect(a.page.getByTestId('abc-notation').locator('svg')).toBeVisible()

    // EXAMPLE_ABC is "C D E F": four notes.
    const notes = a.page.getByTestId('roll-note')
    await expect(notes).toHaveCount(4)

    // Read-only, even for the owner: double-clicking does not add or delete.
    await roll.dblclick({ position: { x: 200, y: 20 } })
    await notes.first().dblclick()
    await expect(notes).toHaveCount(4)
    expect((await readClip(a, recordId)).abc).toBe(EXAMPLE_ABC)
  } finally {
    await callTool(a, 'records_delete', { collection: 'clips', recordId }).catch(() => {})
  }
})
