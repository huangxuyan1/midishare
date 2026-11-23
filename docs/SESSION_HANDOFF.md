# Session handoff — end of session 2, 2026-11-23

For the next agent session. Read this first, then [CLAUDE.md](../CLAUDE.md) (working rules). Open [HANDOFF.md](HANDOFF.md) (the original brief) and [BUILD_LOG.md](BUILD_LOG.md) (everything done, with how it was verified) when you need the detail.

**Hard deadline: Tue Nov 24, 2026, 11:59 PM ET** (confirmed from the invite email). Xuyan submits in the careers portal. The agent never submits.

## 1. Where things stand

The app is finished and submittable. What is left is Xuyan's own checking and the submission note.

- **Live:** https://midishare.app.space (app `midishare`, id `app_01M7VPXYB581QQY5JXH4RF7NAN`).
  - Latest release: `rel_01M83W276QSMPQKC8J53M6JN4C`, commit `84e83db`, `dirty: false`. Every commit after it changes only docs.
- **Repo:** public GitHub `huangxuyan1/midishare`, branch `main`. Everything is committed and pushed.
  - The DeepSpace source is GitHub. **Never run `deepspace push`.**
- **Data:** 5 published example clips written by the agent (record ids `example-*`, source `ai`), owned by Xuyan. Xuyan had not listened to them when they were published.
- **Tests:** 28 unit tests and 11 Playwright tests pass. Type-check and lint are clean.
  - `npx tsc --noEmit`, `npx eslint .`, `npx vitest run`
  - `npx deepspace test run all --port 5187` (port 5173 belongs to another dev server; don't kill it)
- **Test accounts:** "Test A" and "Test B" exist. The Playwright fixture signs them in from the CLI's saved credentials.
- **Skills:** the DeepSpace skill and the 39 Matt Pocock skills are in `.claude/skills/` (gitignored). `skills-lock.json` lists them and is committed.

## 2. To do

1. **Xuyan, by ear.** Press Play in the editor and on a clip page. Confirm that sound comes out and that it lines up with the playhead. Try the space bar. Listen to the five example clips; unpublish or delete any that sound wrong.
2. **Xuyan, the submission note.** Edit [SUBMISSION.md](SUBMISSION.md) and resolve its two TODO lines (the by-ear check, and any code Xuyan changed by hand). Then submit in the portal: live URL, repository, note.
3. **After any code change:** run the checks, commit, deploy, and confirm `dirty: false`. Verify the changed path on the live URL. Add rows to BUILD_LOG.md.
4. **Optional polish**, only if Xuyan asks:
   - `/new` starts with an empty title while the example ABC has `T:Example`
   - in keys without flats (C, Am…), B♭ is spelled `^A`
   - click the bar numbers to seek
5. **Set aside, separate tasks:**
   - **Modular as the audio engine, with a soundfont supernode.** Planned only; see [MODULAR_AUDIO_ENGINE.md](MODULAR_AUDIO_ENGINE.md). The Modular part belongs in a session opened in the Modular folder.
   - **Switching the Ableton bridge to ABC** (`C:\Users\alvin\Documents\Projects\midi-clipboard`). See HANDOFF.md §5.

## 3. What the app does

| Area | What | Main files |
|---|---|---|
| Data | `clips` collection: title, description, tags (comma text), abc, status `draft`/`published`, source `pasted`/`ai`. Server-side maxLength (title 100, description 1000, tags 200, abc 5000). | `src/schemas/clips-schema.ts` (+ `.test.ts`) |
| Permissions | Anyone, including signed-out viewers, reads `published` clips. Members create, and update/delete their own (`'own'`). Admins can delete any clip. Drafts are visible only to their owner (`visibilityField` on status). | same |
| Landing | `/`: static page with a short description and a link to `/home`. | `src/pages/index.tsx`, `src/seo.ts` |
| Browse | `/home`: My clips + Published, newest first, `?q=` (title/tag) and `?tag=` | `src/pages/(app)/home.tsx` |
| Clip page | `/clips/:id`: read-only piano roll with the transport, sheet music, Download .mid, Copy ABC, Show ABC, Make a variation. Owner: Edit, Publish/Unpublish, Delete (confirm dialog). | `src/pages/(app)/clips/[id].tsx`, `src/components/ClipPlayer.tsx` |
| Editor | `/new`, `/new?from=<id>` (variation), `/edit/:id`. The ABC text is the single source of truth. The piano roll, the title/tempo/meter/key fields and the sheet preview are views that write back to it. Each clip gets its own form instance (`key`). | `src/components/ClipForm.tsx`, `MetadataFields.tsx` |
| Piano roll | SVG, 16th grid, C2–B6. Double-click adds a note; drag moves it; dragging the right edge resizes it; double-clicking a note deletes it. Read-only when `onChange` is left out. | `src/components/PianoRoll.tsx` |
| Transport | Play / Stop (keeps the playhead) / Reset, bar.beat counter, amber playhead, sounding notes turn amber, follow-scroll. The space bar toggles play/stop. Used by the editor and the clip page. | `src/lib/use-playback.ts`, `src/components/Transport.tsx` |
| Sheet music | abcjs rendering only; it has no player of its own. | `src/components/AbcView.tsx` |
| ABC ↔ notes | ABC → notes via abcjs `setUpAudio`. Notes → ABC: same start and length form a chord; overlapping chords go into separate voices. Lengths are split into writable values and tied. | `src/lib/abc-notes.ts`, `src/lib/abc-headers.ts` (+ tests) |
| AI assistant | `POST /api/abc/generate` (JWT required, prompt ≤500, currentAbc ≤5000). `createDeepSpaceAI(env,'anthropic',{authToken})`, `maxOutputTokens: 2000`. Validated with `checkAbc`, retried once with the errors, then 502. | `src/server/abc-routes.ts`, `src/components/AiAssist.tsx` |
| Validation | `checkAbc`: requires a `K:` line, at least one parsed line, zero abcjs warnings. | `src/lib/abc.ts` |
| Record tools | `registerAgent` mounts the record tools under `/_deepspace/agent`. `deepspace agent invoke` and the two-user test use them. | `src/ai/agent.ts`, `src/ai/tools.ts` |
| Tests | Unit: schema permissions, ABC validation, ABC ↔ notes. Playwright: smoke, API, two-user ownership, read-only roll. | `src/**/*.test.ts`, `tests/` |

Sound comes from abcjs's synth, which downloads piano samples from a third-party host at play time. See MODULAR_AUDIO_ENGINE.md.

## 4. Decisions already made by Xuyan (don't reopen)

- App name `midishare`; public GitHub source.
- AI is a one-shot generator, not the AI chat feature. The product needs ABC out, not a conversation.
- A single-track piano roll.
- Title/meter/key/tempo are metadata synced with the ABC headers, not piano-roll edits.
- Chord symbols become real notes in the roll, and the roll writes notes back. The round trip doesn't have to give back identical ABC.
- The clip page shows the piano roll too, read-only.
- The space bar toggles play/stop.
- Repo cleanup: process docs live in `docs/`; the unmounted AI chat routes and the `/api-status` page are removed; the installed skill copies are gitignored.
- The Modular audio engine is a separate task, set aside.
- **Chosen by the agent; Xuyan may change these:**
  - A key change keeps the pitches and re-spells them; it does not transpose.
  - Stop keeps the playhead where it is.
  - The example clips carry source `ai`, so they show the "AI-generated" badge.
  - The unused Durable Object classes stay in `worker.ts`, because removing a deployed class needs a migration.

## 5. Gotchas learned the hard way

- **Deploy output** goes to the scratchpad, never into the repo. A file inside the repo makes the release dirty.
  - `npx deepspace deploy --json > <scratchpad>/deploy.json 2>&1`
- **Server-side records check:** write `{"collection":"clips"}` to a file in the scratchpad, then
  `npx deepspace agent invoke midishare records_query --input-file <that file>`.
  - `records_get` returns `{ record: { data } }`. Refusals say `READ DENIED`, `UPDATE DENIED` or `DELETE DENIED`.
  - `npx deepspace logs --since 10m` shows server errors.
- **Test accounts:** when Xuyan needs to create one, give the full command with `--password <value>` filled in. Xuyan runs it. The agent never types a password into the production site.
- **abcjs ties inside chords:** abcjs only follows a tie inside a chord into a next chord that has the tied note at the same position. That's why the writer uses voices.
- **abcjs `onEnded`** also fires on a manual stop. `use-playback.ts` detects the end from the duration `prime()` returns.
- **AI credits:** an unset `maxOutputTokens` reserves 64k tokens of credits up front and fails with 402. Keep the 2000 cap.
- **Built-in browser pane:**
  - The screenshot frame isn't the same size as the CSS viewport. Use refs or in-page scripts instead of coordinates.
  - For timing-sensitive checks, drive the page from one in-page script.
  - When the pane is hidden, animation frames pause: a playhead sample can read as "not moving". Sample several times.
  - To move between app URLs without a page load: `history.pushState` then dispatch a `popstate` event.
- **Sign-in:** Xuyan is signed in on midishare.app.space in the built-in browser. The agent never signs in or creates accounts.
- **Build log:** insert rows before the `\nTypes:` line of `docs/BUILD_LOG.md`. Row types: `decision`, `agent`, `verified`, `changed-by-me`, `deploy`, `issue`.
- **Line endings:** files are LF in the repo. When editing with a script, keep each file's existing line ending.
