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

// ── Display names: A is the publisher, B is a reader ────────────────────────

test('a display name shows on the clips; without one the clip is anonymous', async ({ users }) => {
  test.setTimeout(90_000)
  const [a, b] = await users(2)

  // Every list of users the server sends B's browser, to check below that A is not in it.
  const userListsSentToB: string[] = []
  b.page.on('websocket', (socket) =>
    socket.on('framereceived', (frame) => {
      const text = String(frame.payload)
      if (text.includes('"user.list"')) userListsSentToB.push(text)
    }),
  )

  for (const user of [a, b]) {
    await user.page.goto('/home')
    await expect(user.page.getByTestId('nav-user-name')).toHaveText(/\S/, { timeout: 15_000 })
  }

  const stamp = Date.now()
  const clipId = `test-author-${stamp}`
  const clipTitle = `__test-${stamp}__ author`
  const name = `Tester ${stamp}`
  let aId = ''

  /** A's profile records, as the server lists them to anyone. */
  async function profilesOfA() {
    const listed = await callTool(b, 'records_query', { collection: 'profiles' })
    expect(listed.ok, listed.error).toBe(true)
    return listed.result.data.records.filter((r: { createdBy: string }) => r.createdBy === aId)
  }

  async function removeProfilesOfA() {
    for (const profile of await profilesOfA()) {
      await callTool(a, 'records_delete', { collection: 'profiles', recordId: profile.recordId })
    }
  }

  try {
    // A publishes a clip. The record's `createdBy` is A's user id.
    const created = await callTool(a, 'records_create', {
      collection: 'clips',
      recordId: clipId,
      data: { title: clipTitle, abc: EXAMPLE_ABC, status: 'published' },
    })
    expect(created.ok, created.error).toBe(true)
    const read = await callTool(b, 'records_get', { collection: 'clips', recordId: clipId })
    aId = read.result.data.record.createdBy
    expect(aId).toMatch(/\S/)
    await removeProfilesOfA() // a name left by an earlier run

    // Without a display name, B reads "by Anonymous", and there is no link to a profile.
    await b.page.goto(`/clips/${clipId}`)
    const author = b.page.getByTestId('clip-author')
    await expect(author).toHaveText(`by Anonymous`, { timeout: 15_000 })
    await expect(author.getByRole('link')).toHaveCount(0)
    await b.page.goto(`/u/${aId}`)
    await expect(b.page.getByText('No public profile')).toBeVisible({ timeout: 15_000 })
    await expect(b.page.getByText(clipTitle)).toHaveCount(0)

    // A sets a display name in Settings.
    await a.page.goto('/settings')
    const field = a.page.getByLabel('Display name')
    const save = a.page.getByRole('button', { name: 'Save' })
    await expect(field).toBeEnabled({ timeout: 15_000 })
    await field.fill(name)
    await save.click()
    await expect(a.page.getByText('Name saved')).toBeVisible({ timeout: 15_000 })
    expect(await profilesOfA()).toHaveLength(1)

    // B sees the name on the clip page, on the library card, and on A's page.
    await b.page.goto(`/clips/${clipId}`)
    await expect(author).toHaveText(`by ${name}`, { timeout: 15_000 })
    await b.page.goto(`/home?q=${encodeURIComponent(clipTitle)}`)
    const card = b.page.getByTestId('clip-row').filter({ hasText: clipTitle })
    await expect(card.getByTestId('card-author')).toHaveText(`by ${name}`, { timeout: 15_000 })
    await card.click()
    await author.getByRole('link', { name }).click()
    await expect(b.page).toHaveURL(new RegExp(`/u/${aId}$`))
    await expect(b.page.getByTestId('profile-name')).toHaveText(name, { timeout: 15_000 })
    await expect(b.page.getByText(clipTitle)).toBeVisible()
    await expect(b.page.getByTestId('profile-drafts')).toHaveCount(0)

    // Server: B cannot change or delete A's profile.
    const [profile] = await profilesOfA()
    const edit = await callTool(b, 'records_update', {
      collection: 'profiles',
      recordId: profile.recordId,
      data: { displayName: 'changed by B' },
    })
    expect(edit.ok).toBe(false)
    expect(edit.error).toContain('UPDATE DENIED')
    const remove = await callTool(b, 'records_delete', { collection: 'profiles', recordId: profile.recordId })
    expect(remove.ok).toBe(false)
    expect(remove.error).toContain('DELETE DENIED')

    // Server: B cannot read A's account row, and no list of users sent to B has A in it.
    const account = await callTool(b, 'records_get', { collection: 'users', recordId: aId })
    expect(account.ok).toBe(false)
    expect(userListsSentToB.length).toBeGreaterThan(0)
    expect(userListsSentToB.join('\n')).not.toContain(aId)

    // A's own page has the name and the clip.
    await a.page.goto('/me')
    await expect(a.page.getByTestId('profile-name')).toHaveText(name, { timeout: 15_000 })
    await expect(a.page.getByText(clipTitle)).toBeVisible()

    // A empties the field: the clip is anonymous again, and A's page is gone for B.
    await a.page.goto('/settings')
    await expect(field).toHaveValue(name, { timeout: 15_000 })
    await field.fill('')
    await save.click()
    await expect(a.page.getByText('Name removed')).toBeVisible({ timeout: 15_000 })
    expect(await profilesOfA()).toHaveLength(0)
    await expect(b.page.getByText('No public profile')).toBeVisible({ timeout: 15_000 })
    await b.page.goto(`/clips/${clipId}`)
    await expect(author).toHaveText('by Anonymous', { timeout: 15_000 })
  } finally {
    await callTool(a, 'records_delete', { collection: 'clips', recordId: clipId }).catch(() => {})
    if (aId) await removeProfilesOfA().catch(() => {})
  }
})

test('the editor undoes and redoes changes', async ({ users }) => {
  const [a] = await users(1)
  await a.page.goto('/new')
  const notes = a.page.getByTestId('roll-note')
  await expect(notes.first()).toBeVisible({ timeout: 15_000 })
  const undo = a.page.getByTestId('undo')
  const redo = a.page.getByTestId('redo')
  const title = a.page.getByLabel('Title')

  // Nothing has changed yet.
  const before = await notes.count()
  await expect(undo).toBeDisabled()
  await expect(redo).toBeDisabled()

  // Delete a note in the roll, then undo and redo it with the buttons.
  await notes.first().dblclick()
  await expect(notes).toHaveCount(before - 1)
  await undo.click()
  await expect(notes).toHaveCount(before)
  await expect(undo).toBeDisabled()
  await redo.click()
  await expect(notes).toHaveCount(before - 1)

  // The keyboard does the same, from inside a text field too.
  await title.click()
  await a.page.keyboard.press('Control+z')
  await expect(notes).toHaveCount(before)
  await a.page.keyboard.press('Control+y')
  await expect(notes).toHaveCount(before - 1)

  // Drag a note up two rows (12 px each) with the mouse: the ABC changes, and one undo puts it back.
  const abc = a.page.getByLabel('ABC notation')
  const abcBeforeDrag = await abc.inputValue()
  // Grab it in the middle: its two ends resize it.
  const box = (await notes.first().boundingBox())!
  await a.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await a.page.mouse.down()
  await a.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 24, { steps: 4 })
  await a.page.mouse.up()
  await expect(abc).not.toHaveValue(abcBeforeDrag)
  await a.page.keyboard.press('Control+z')
  await expect(abc).toHaveValue(abcBeforeDrag)

  // A burst of typing is one step, and the ABC's T: line follows the title.
  const titleBefore = await title.inputValue()
  await title.press('End')
  await title.pressSequentially(' v2')
  await expect(title).toHaveValue(`${titleBefore} v2`)
  await expect(abc).toHaveValue(new RegExp(`T:${titleBefore} v2`))
  await a.page.keyboard.press('Control+z')
  await expect(title).toHaveValue(titleBefore)
  await a.page.keyboard.press('Control+Shift+z')
  await expect(title).toHaveValue(`${titleBefore} v2`)
})

test('the editor accepts a length that is not one written note value', async ({ users }) => {
  const [a] = await users(1)
  await a.page.goto('/new')
  const notes = a.page.getByTestId('roll-note')
  await expect(notes.first()).toBeVisible({ timeout: 15_000 })

  // F5 and z5 are five eighths: legal ABC that abcjs warns about but reads correctly.
  await a.page.getByLabel('ABC notation').fill('X:1\nT:Odd lengths\nM:4/4\nL:1/8\nK:C\nF5 z3 | z5 A3 |]')
  await expect(a.page.getByTestId('abc-error')).toHaveCount(0)
  await expect(a.page.getByTestId('abc-notation').locator('svg')).toBeVisible()
  await expect(notes).toHaveCount(2)
})

test('the editor lines up voices that have different numbers of lines', async ({ users }) => {
  const [a] = await users(1)
  await a.page.goto('/new')
  const notes = a.page.getByTestId('roll-note')
  await expect(notes.first()).toBeVisible({ timeout: 15_000 })
  const abc = a.page.getByLabel('ABC notation')
  const error = a.page.getByTestId('abc-error')

  // V:1 has one line of music and V:2 has two, so abcjs would play the second line in the wrong voice.
  const exported =
    'X:1\nT:Two voices\nM:4/4\nL:1/8\nK:C\n' +
    'V:1\nZ6 | z2 A z5 |]\n' +
    'V:2\nC8 | D8 | E8 | F8 |\nG8 | A8 | B8 | c8 |]'
  await abc.fill(exported)
  await expect(error).toContainText('different numbers of music lines')
  await expect(a.page.getByRole('button', { name: 'Publish' })).toBeDisabled()

  // The button rewrites the music: four bars per line, both voices in each group.
  await a.page.getByTestId('line-up-voices').click()
  await expect(error).toHaveCount(0)
  await expect(abc).toHaveValue(/V:1\nZ \| Z \| Z \| Z \|\nV:2\nC8 \| D8 \| E8 \| F8 \|\nV:1\nZ \| Z \| z2 A z5 \| Z \|\]\nV:2\nG8/)
  await expect(a.page.getByTestId('abc-notation').locator('svg')).toBeVisible()
  await expect(notes).toHaveCount(9)

  // One undo brings the pasted text back.
  await a.page.keyboard.press('Control+z')
  await expect(abc).toHaveValue(exported)
  await expect(error).toBeVisible()
})

test('dragging in the ruler moves the playhead', async ({ users }) => {
  const [a] = await users(1)
  await a.page.goto('/new')
  const notes = a.page.getByTestId('roll-note')
  await expect(notes.first()).toBeVisible({ timeout: 15_000 })
  const abc = a.page.getByLabel('ABC notation')
  const text = 'X:1\nT:Seek\nM:4/4\nL:1/4\nK:C\nC D E F | G A B c |]'
  await abc.fill(text)
  await expect(notes).toHaveCount(8)

  const position = a.page.getByTestId('position')
  const playhead = a.page.getByTestId('playhead')
  await expect(position).toHaveText('1.1')

  // The roll draws 14 pixels per 16th note, after a 36-pixel keyboard.
  const ruler = (await a.page.getByTestId('ruler').boundingBox())!
  const xOfStep = (step: number) => ruler.x + 36 + step * 14
  const y = ruler.y + ruler.height / 2

  // Step 20 is bar 2, beat 2. The playhead follows the pointer while the button is down.
  await a.page.mouse.move(xOfStep(0), y)
  await a.page.mouse.down()
  await a.page.mouse.move(xOfStep(20), y, { steps: 5 })
  await expect(position).toHaveText('2.2')
  await expect(playhead).toHaveAttribute('x1', String(36 + 20 * 14))

  // It keeps following below the ruler, and it stops at the start of the roll.
  await a.page.mouse.move(xOfStep(8), y + 100, { steps: 5 })
  await expect(position).toHaveText('1.3')
  await a.page.mouse.move(ruler.x - 50, y + 100, { steps: 5 })
  await expect(position).toHaveText('1.1')
  await a.page.mouse.move(xOfStep(8), y, { steps: 5 })
  await a.page.mouse.up()
  await expect(position).toHaveText('1.3')
  await expect(playhead).toHaveAttribute('x1', String(36 + 8 * 14))

  // After the button is up, moving the pointer does nothing. A single click jumps.
  await a.page.mouse.move(xOfStep(20), y)
  await expect(position).toHaveText('1.3')
  await a.page.mouse.click(xOfStep(16), y)
  await expect(position).toHaveText('2.1')

  // Moving the playhead is not an edit: the notes and the ABC are untouched.
  await expect(notes).toHaveCount(8)
  await expect(abc).toHaveValue(text)
})

test('while a long clip plays, the playhead stays in the middle and the roll slides under it', async ({ users }) => {
  test.setTimeout(60_000)
  const [a] = await users(1)
  await a.page.goto('/new')
  await expect(a.page.getByTestId('roll-note').first()).toBeVisible({ timeout: 15_000 })

  // Twelve bars at 300 BPM: about ten seconds, and several times wider than the view.
  const bars = Array.from({ length: 12 }, () => 'C D E F').join(' | ')
  await a.page.getByLabel('ABC notation').fill(`X:1\nT:Follow\nM:4/4\nL:1/4\nQ:1/4=300\nK:C\n${bars} |]`)
  await expect(a.page.getByTestId('roll-note')).toHaveCount(48)

  /** Where the roll is scrolled to, and where the playhead is inside the visible part. */
  const view = () =>
    a.page.evaluate(() => {
      const roll = document.querySelector('[data-testid="piano-roll"]')!
      const head = document.querySelector('[data-testid="playhead"]')!
      return {
        scroll: roll.scrollLeft,
        maxScroll: roll.scrollWidth - roll.clientWidth,
        playheadAt: head.getBoundingClientRect().x - roll.getBoundingClientRect().x,
        middle: roll.clientWidth / 2,
      }
    })

  // The first Play downloads Modular and the piano, so give it time to start.
  const transport = a.page.getByTestId('transport')
  await transport.getByRole('button', { name: 'Play' }).click()
  await expect(transport.getByRole('button', { name: 'Stop' })).toBeVisible({ timeout: 30_000 })

  // Once the playhead has reached the middle, the roll moves and the playhead stays there.
  await expect.poll(async () => (await view()).scroll, { timeout: 10_000 }).toBeGreaterThan(50)
  const first = await view()
  expect(Math.abs(first.playheadAt - first.middle)).toBeLessThan(4)
  await a.page.waitForTimeout(500)
  const second = await view()
  expect(second.scroll).toBeGreaterThan(first.scroll + 100)
  expect(second.scroll).toBeLessThan(second.maxScroll)
  expect(Math.abs(second.playheadAt - second.middle)).toBeLessThan(4)

  // Near the end the roll has nowhere left to go, and the playhead travels on to the right.
  await expect
    .poll(
      async () => {
        const v = await view()
        return v.scroll >= v.maxScroll - 1 && v.playheadAt > v.middle + 40
      },
      { timeout: 15_000, intervals: [100] },
    )
    .toBe(true)

  // At the end the playhead returns to the start, and so does the view.
  await expect(transport.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 15_000 })
  await expect(a.page.getByTestId('position')).toHaveText('1.1')
  expect((await view()).scroll).toBe(0)
})

test('importing a MIDI file replaces the clip with its notes', async ({ users }) => {
  const [a] = await users(1)
  await a.page.goto('/new')
  const notes = a.page.getByTestId('roll-note')
  await expect(notes.first()).toBeVisible({ timeout: 15_000 })
  const abc = a.page.getByLabel('ABC notation')
  const before = await abc.inputValue()
  const picker = a.page.getByTestId('midi-file')
  const note = a.page.getByTestId('import-note')

  // A two-track file with 96 ticks per quarter note. Track 1 sets the tempo to
  // 150 BPM; track 2 plays C4 and then E4, a quarter note each.
  const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0))
  const endOfTrack = [0x00, 0xff, 0x2f, 0x00]
  const bytes = [
    ...[...ascii('MThd'), 0, 0, 0, 6, 0, 1, 0, 2, 0, 96],
    ...[...ascii('MTrk'), 0, 0, 0, 11, 0x00, 0xff, 0x51, 0x03, 0x06, 0x1a, 0x80, ...endOfTrack],
    ...[...ascii('MTrk'), 0, 0, 0, 20],
    ...[0x00, 0x90, 60, 100, 96, 0x80, 60, 0],
    ...[0x00, 0x90, 64, 100, 96, 0x80, 64, 0],
    ...endOfTrack,
  ]
  await picker.setInputFiles({ name: 'Two notes.mid', mimeType: 'audio/midi', buffer: Buffer.from(bytes) })

  await expect(notes).toHaveCount(2)
  await expect(note).toHaveText('Imported Two notes.mid: 1 bar.')
  await expect(a.page.locator('#title')).toHaveValue('Two notes')
  await expect(abc).toHaveValue(/Q:1\/4=150\nK:C\nC2 E2 z4 \|\]/)
  await expect(a.page.getByTestId('abc-error')).toHaveCount(0)
  await expect(a.page.getByTestId('abc-notation').locator('svg')).toBeVisible()

  // One undo brings the clip from before the import back.
  await a.page.keyboard.press('Control+z')
  await expect(abc).toHaveValue(before)

  // A file that is not MIDI changes nothing and says why.
  await picker.setInputFiles({ name: 'notes.mid', mimeType: 'audio/midi', buffer: Buffer.from('hello') })
  await expect(note).toHaveText('This is not a MIDI file.')
  await expect(abc).toHaveValue(before)
})

test('a note is resized by dragging either end, and the cursor shows it', async ({ users }) => {
  const [a] = await users(1)
  await a.page.goto('/new')
  const notes = a.page.getByTestId('roll-note')
  await expect(notes.first()).toBeVisible({ timeout: 15_000 })

  // A half rest, then a half note on middle C: the note covers steps 8 to 16.
  const abc = a.page.getByLabel('ABC notation')
  await abc.fill('X:1\nT:Resize\nM:4/4\nL:1/4\nK:C\nz2 C2 |]')
  await expect(notes).toHaveCount(1)
  const note = notes.first()
  const before = (await note.boundingBox())!
  const y = before.y + before.height / 2

  // The cursor is a hand in the middle and a left-right arrow at both ends.
  await a.page.mouse.move(before.x + before.width / 2, y)
  await expect(note).toHaveCSS('cursor', 'grab')
  await a.page.mouse.move(before.x + before.width - 2, y)
  await expect(note).toHaveCSS('cursor', 'ew-resize')
  await a.page.mouse.move(before.x + 2, y)
  await expect(note).toHaveCSS('cursor', 'ew-resize')

  // Drag the left end four steps (14 pixels each) to the left: the note starts earlier and ends where it did.
  await a.page.mouse.down()
  await a.page.mouse.move(before.x + 2 - 56, y, { steps: 4 })
  await a.page.mouse.up()
  await expect(abc).toHaveValue(/\nz C3 \|\]/)
  const longer = (await note.boundingBox())!
  expect(longer.x).toBeCloseTo(before.x - 56, 0)
  expect(longer.x + longer.width).toBeCloseTo(before.x + before.width, 0)

  // Dragging it to the right makes the note shorter, but never shorter than one step.
  await a.page.mouse.move(longer.x + 2, y)
  await a.page.mouse.down()
  await a.page.mouse.move(longer.x + 2 + 400, y, { steps: 4 })
  await a.page.mouse.up()
  const shortest = (await note.boundingBox())!
  expect(shortest.width).toBeCloseTo(14 - 2, 0)
  expect(shortest.x + shortest.width).toBeCloseTo(before.x + before.width, 0)

  // The right end still works: two steps longer.
  await a.page.mouse.move(shortest.x + shortest.width - 2, y)
  await a.page.mouse.down()
  await a.page.mouse.move(shortest.x + shortest.width - 2 + 28, y, { steps: 4 })
  await a.page.mouse.up()
  const grown = (await note.boundingBox())!
  expect(grown.x).toBeCloseTo(shortest.x, 0)
  expect(grown.width).toBeCloseTo(3 * 14 - 2, 0)
})

/**
 * The abcjs synth, the backup audio engine, loads one piano sample per pitch
 * (C4.mp3, Db4.mp3, ...). The requests for them show that the backup played,
 * and which pitches. The Modular engine makes no such requests.
 */
function watchSamples(page: MultiplayerUser['page']): string[] {
  const samples: string[] = []
  page.on('request', (request) => {
    const match = request.url().match(/-mp3\/(\w+)\.mp3/)
    if (match) samples.push(match[1])
  })
  return samples
}

type Sound = { seconds: number; peak: number }

/**
 * Records every buffer the page starts playing: its length and its loudest
 * sample. Call it before the page is opened. The returned function reads the
 * list so far.
 */
async function watchSounds(page: MultiplayerUser['page']): Promise<() => Promise<Sound[]>> {
  await page.addInitScript(() => {
    const sounds: { seconds: number; peak: number }[] = []
    ;(window as unknown as { sounds: unknown }).sounds = sounds
    const start = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (...args) {
      let peak = 0
      for (const sample of this.buffer!.getChannelData(0)) peak = Math.max(peak, Math.abs(sample))
      sounds.push({ seconds: this.buffer!.duration, peak })
      return start.apply(this, args)
    }
  })
  return () => page.evaluate(() => (window as unknown as { sounds: Sound[] }).sounds)
}

test('a note shows its name under the pointer, and sounds when pressed or dragged to a new pitch', async ({ users }) => {
  const [a] = await users(1)
  const samples = watchSamples(a.page)
  const sounds = await watchSounds(a.page)
  await a.page.goto('/new')
  const notes = a.page.getByTestId('roll-note')
  await expect(notes.first()).toBeVisible({ timeout: 15_000 })

  // One whole note on middle C.
  await a.page.getByLabel('ABC notation').fill('X:1\nT:Preview\nM:4/4\nL:1/4\nK:C\nC4 |]')
  await expect(notes).toHaveCount(1)
  const label = a.page.getByTestId('note-label')
  await expect(label).toHaveCount(0)

  // Pointing at the note names it, without a sound.
  const box = (await notes.first().boundingBox())!
  const x = box.x + 40
  const y = box.y + box.height / 2
  await a.page.mouse.move(x, y)
  await expect(label).toHaveText('C4')
  expect(await sounds()).toEqual([])

  // Pressing it plays one short sound that is not silence.
  await a.page.mouse.down()
  await expect.poll(async () => (await sounds()).length).toBe(1)
  const [first] = await sounds()
  expect(first.seconds).toBeLessThan(2.5)
  expect(first.peak).toBeGreaterThan(0.05)

  // Dragging it up plays each new pitch, one row (12 pixels) at a time. Each
  // sound is waited for, because a preview that is still being rendered when
  // the next one is asked for is dropped.
  await a.page.mouse.move(x, y - 12)
  await expect(label).toHaveText('C#4')
  await expect.poll(async () => (await sounds()).length).toBe(2)
  await a.page.mouse.move(x, y - 24)
  await expect(label).toHaveText('D4')
  await expect.poll(async () => (await sounds()).length).toBe(3)
  await a.page.mouse.move(x, y - 36)
  await expect(label).toHaveText('D#4')
  await expect.poll(async () => (await sounds()).length).toBe(4)

  // Moving sideways keeps the pitch, so nothing new plays.
  await a.page.mouse.move(x + 28, y - 36)
  await a.page.mouse.up()
  await expect(a.page.getByLabel('ABC notation')).toHaveValue(/\^D/)
  expect(await sounds()).toHaveLength(4)

  // Away from the note, the name goes.
  await a.page.mouse.move(x + 28, y + 60)
  await expect(label).toHaveCount(0)

  // All of it was the Modular engine: the backup synth downloaded no samples.
  expect(samples).toEqual([])
})

test('Play renders the clip with the Modular engine', async ({ users }) => {
  const [a] = await users(1)
  const samples = watchSamples(a.page)
  const sounds = await watchSounds(a.page)
  await a.page.goto('/new')
  await expect(a.page.getByTestId('roll-note').first()).toBeVisible({ timeout: 15_000 })

  // One bar of 4/4 at 120 beats a minute: two seconds of music.
  await a.page.getByLabel('ABC notation').fill('X:1\nT:Modular\nM:4/4\nL:1/4\nQ:1/4=120\nK:C\nC E G c |]')
  await a.page.getByTestId('transport').getByRole('button', { name: 'Play' }).click()

  await expect.poll(async () => (await sounds()).length).toBe(1)
  const [sound] = await sounds()
  // The buffer is the music and then the last note dying away, for at most two more seconds.
  expect(sound.seconds).toBeGreaterThan(1.99)
  expect(sound.seconds).toBeLessThan(4.01)
  // It is sound, and the gain has not pushed it past full scale.
  expect(sound.peak).toBeGreaterThan(0.05)
  expect(sound.peak).toBeLessThan(1)
  expect(samples).toEqual([])
})

test('Modular loads without console errors when the host serves its file as plain bytes', async ({ users }) => {
  const [a] = await users(1)
  const samples = watchSamples(a.page)
  const sounds = await watchSounds(a.page)
  const errors: string[] = []
  a.page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  // The live host serves the .wasm as "application/octet-stream", not
  // "application/wasm" as the local server does. Do the same here.
  await a.page.route('**/*.wasm', async (route) => {
    const response = await route.fetch()
    await route.fulfill({ response, headers: { ...response.headers(), 'content-type': 'application/octet-stream' } })
  })
  await a.page.goto('/new')
  await expect(a.page.getByTestId('roll-note').first()).toBeVisible({ timeout: 15_000 })

  await a.page.getByLabel('ABC notation').fill('X:1\nT:Plain bytes\nM:4/4\nL:1/4\nQ:1/4=120\nK:C\nC E G c |]')
  await a.page.getByTestId('transport').getByRole('button', { name: 'Play' }).click()

  await expect.poll(async () => (await sounds()).length).toBe(1)
  expect(samples).toEqual([]) // Modular played, not the backup
  expect(errors).toEqual([])
})

test('when Modular cannot load, the abcjs synth plays the note', async ({ users }) => {
  const [a] = await users(1)
  const samples = watchSamples(a.page)
  await a.page.route('**/*.wasm', (route) => route.abort())
  await a.page.goto('/new')
  const notes = a.page.getByTestId('roll-note')
  await expect(notes.first()).toBeVisible({ timeout: 15_000 })

  await a.page.getByLabel('ABC notation').fill('X:1\nT:Backup\nM:4/4\nL:1/4\nK:C\nC4 |]')
  await expect(notes).toHaveCount(1)
  const box = (await notes.first().boundingBox())!
  await a.page.mouse.move(box.x + 40, box.y + box.height / 2)
  await a.page.mouse.down()
  await a.page.mouse.up()

  // The backup synth asks for the sample of the pitch it was told to play.
  await expect.poll(() => samples).toEqual(['C4'])
})

test('the clip page shows a read-only piano roll with a transport', async ({ users }) => {
  const [a] = await users(1)
  const sounds = await watchSounds(a.page)
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
    // Under the Copy ABC button, a link to the page about pasting into Ableton.
    await expect(a.page.getByRole('link', { name: 'Paste the copied ABC straight into Ableton Live' })).toHaveAttribute('href', '/ableton')

    // EXAMPLE_ABC is "C D E F": four notes.
    const notes = a.page.getByTestId('roll-note')
    await expect(notes).toHaveCount(4)

    // Read-only, even for the owner: double-clicking does not add or delete.
    await roll.dblclick({ position: { x: 200, y: 60 } })
    await notes.first().dblclick()
    await expect(notes).toHaveCount(4)
    expect((await readClip(a, recordId)).abc).toBe(EXAMPLE_ABC)

    // The notes still show their names and sound when pressed: the first one is middle C.
    await notes.first().hover()
    await expect(a.page.getByTestId('note-label')).toHaveText('C4')
    await expect.poll(async () => (await sounds()).length).toBeGreaterThan(0)

    // The playhead can still be moved here: a click in the ruler at step 8 (36 + 8 * 14 pixels).
    await a.page.getByTestId('ruler').click({ position: { x: 36 + 8 * 14, y: 9 } })
    await expect(a.page.getByTestId('position')).toHaveText('1.3')
  } finally {
    await callTool(a, 'records_delete', { collection: 'clips', recordId }).catch(() => {})
  }
})
