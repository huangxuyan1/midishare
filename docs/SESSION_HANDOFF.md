# Session handoff — 2026-11-23

Written at the end of session 1 and updated during session 2 (same day) for the next agent session. Read this, then [HANDOFF.md](HANDOFF.md) (the original brief), [CLAUDE.md](../CLAUDE.md) (working rules) and [BUILD_LOG.md](BUILD_LOG.md) (everything done so far, with how it was verified).

**Hard deadline: Mon Nov 24, 2026, 11:59 PM ET.** Xuyan submits in the careers portal. The agent never submits.

## 1. Where things stand

- **Live:** https://midishare.app.space (app `midishare`, id `app_01M7VPXYB581QQY5JXH4RF7NAN`).
  - Latest release: `rel_01M83W276QSMPQKC8J53M6JN4C`, commit `84e83db`, `dirty: false`. Commits after it change only docs.
- **Repo:** public GitHub `huangxuyan1/midishare`, branch `main`, everything pushed.
  - The DeepSpace source is GitHub, claimed on the first deploy. **Never run `deepspace push`.**
- **Data:** the server holds 5 published clips written by the agent (record ids `example-*`, source `ai`), owned by Xuyan, published with Xuyan's go-ahead. Xuyan had not listened to them yet; unpublish or delete any that sound wrong.
- **Tests:** 28 unit tests and 11 Playwright tests pass (`npx deepspace test run all --port 5187`). Type-check and lint are clean.
  - Commands: `npx tsc --noEmit`, `npx eslint src`, `npx vitest run`.
- **Skills:** the DeepSpace skill and the 39 Matt Pocock skills (`npx skills@1.9.0 add mattpocock/skills`) are installed in `.claude/skills/`; `skills-lock.json` lists them.
- **Uncommitted: nothing** (settled in session 2). `skills-lock.json` is committed; the installed skill copies (`.agents/`, `.claude/skills/`) are gitignored. The process docs (this file, HANDOFF.md, BUILD_LOG.md, SUBMISSION.md) moved into `docs/`.

## 2. What the app does

| Area | What | Main files |
|---|---|---|
| Data | `clips` collection: title, description, tags (comma text), abc, status `draft`/`published`, source `pasted`/`ai`. Server-side maxLength (title 100, description 1000, tags 200, abc 5000). | `src/schemas/clips-schema.ts` (+ `.test.ts`) |
| Permissions | Anyone, including signed-out viewers, reads `published` clips. Members create, and update/delete their own (`'own'`). Admins can delete any clip. Drafts are visible only to their owner (`visibilityField` on status). | same |
| Browse | `/home`: My clips + Published, newest first, `?q=` (title/tag) and `?tag=` | `src/pages/(app)/home.tsx` |
| Clip page | `/clips/:id`: read-only piano roll with the transport (session 2), sheet music, Download .mid, Copy ABC, Show ABC, Make a variation. Owner: Edit, Publish/Unpublish, Delete (confirm dialog). | `src/pages/(app)/clips/[id].tsx`, `src/components/ClipPlayer.tsx`, `AbcView.tsx` (sheet music only) |
| Editor | `/new`, `/new?from=<id>` (variation), `/edit/:id`. The ABC text is the single source of truth. The piano roll, the title/tempo/meter/key fields and the sheet preview are views that write back to it. | `src/components/ClipForm.tsx`, `MetadataFields.tsx` |
| Piano roll | SVG, 16th grid, C2–B6. Double-click adds a note; drag moves it; dragging the right edge resizes it; double-clicking a note deletes it. Keys keep piano colors in dark mode. | `src/components/PianoRoll.tsx` |
| Transport | Play / Stop (keeps the playhead) / Reset (back to the start), bar.beat counter, amber playhead, sounding notes turn amber, follow-scroll. At the end the playhead returns to the start. | `src/lib/use-playback.ts`, `src/components/Transport.tsx` |
| ABC ↔ notes | ABC → notes via abcjs `setUpAudio` (key, ties and chord symbols resolved). Notes → ABC: notes with the same start and length form a chord, and overlapping chords go into separate voices (`V:1`, `V:2 clef=bass`…). Lengths are split into writable values and tied. | `src/lib/abc-notes.ts`, `src/lib/abc-headers.ts` (+ tests) |
| AI assistant | `POST /api/abc/generate` (JWT required, prompt ≤500, currentAbc ≤5000). `createDeepSpaceAI(env,'anthropic',{authToken})` (the caller's credits, no API key), `DEEPSPACE_AI_DEFAULTS.directGeneration`, `maxOutputTokens: 2000`. Validated with `checkAbc`, retried once with the errors, then 502; a 402 becomes "Not enough DeepSpace credits". | `src/server/abc-routes.ts`, `src/components/AiAssist.tsx` |
| Validation | `checkAbc`: requires a `K:` line, at least one parsed line, zero abcjs warnings. Saving is disabled until it passes. | `src/lib/abc.ts` |

Everything above was verified on the live URL; BUILD_LOG.md has each check.

## 3. To do, in priority order

1. **Xuyan, by ear:** press Play in the editor and on a clip page (both use the same transport now). Confirm that sound comes out and that it lines up with the playhead. Listen to the five example clips.
2. **Two-user ownership test: done in session 2 on the local dev worker (4/4 pass, mutation-checked; see BUILD_LOG.md).** Test accounts "Test A" and "Test B" exist. Not repeated on the live URL. Original notes: The spec is the last test in `tests/collab.spec.ts`. Run it with `npx deepspace test run tests/collab.spec.ts --port 5187` (port 5173 was taken by another dev server; don't kill it). It skips until Xuyan creates 2 test accounts, for example:
   `npx deepspace test accounts create --email a@deepspace.test --name "Test A" --password-stdin`
   - The agent must not create accounts or enter passwords.
   - Then use either the scaffold's multi-user Playwright fixture (`tests/collab.spec.ts`, `deepspace/testing`, `npm run test:e2e`) or a manual check: user B cannot edit or delete A's clip and cannot see A's drafts.
   - Check that the server enforces this (a direct records call), not only the UI.
   - Use `__test__` titles and delete the test clips afterwards.
3. **README.md: done in session 2** (update it after the decisions in items 5 and 6). It covers what it is, the live URL, how to run (`npm install`, `npm run dev`), the architecture (table above), the DeepSpace features used and the ones skipped with reasons, and known limits.
4. **Submission note draft: `SUBMISSION.md` written in session 2**, with TODO marks for the by-ear check, Xuyan's own code changes and the two-user test. Remove each TODO as it gets done. Xuyan edits and submits it. It must cover:
   - what was built
   - the DeepSpace integrations used: auth, records + RBAC with realtime `useQuery`, server-side AI via `createDeepSpaceAI`, deploys
   - the ones skipped, and why (payments, collaborative editing, files, scheduled jobs…)
   - the main tradeoff: ABC as the single format, losing velocity and timing detail and MIDI import, plus the lossy roll ↔ ABC rewrite
   - what the agent did vs. what Xuyan verified

   Build it from BUILD_LOG.md and don't invent anything. Unfinished parts must be stated honestly.
5. **Scaffold leftovers: done in session 2.** Removed the unmounted AI chat routes (`src/ai/chat-routes.ts`), the `/api-status` page with its two tests, and the yarn/pnpm config files. Kept `registerAgent` (`src/ai/agent.ts`, `tools.ts`): its tool routes serve `deepspace agent invoke` and the two-user test. Kept the unused Durable Object classes in `worker.ts`: removing a deployed class needs a migration.
6. **Final deploy:** must be clean (`dirty: false`). Redeploy after any later change, and verify the important path live once more.
7. **Optional polish**, only if time allows; ask first (the scaffold landing page copy was already replaced in session 2):
   - `/new` starts with an empty title while the example ABC has `T:Example`
   - in keys without flats (C, Am…), B♭ is spelled `^A`
   - click the bar numbers to seek
   - space bar for play/stop (done in session 2)
8. **Separate workstream, not required:** switch the Ableton bridge (`C:\Users\alvin\Documents\Projects\midi-clipboard`) to ABC. See HANDOFF.md §5.

## 4. Decisions already made by Xuyan (don't reopen)

- App name `midishare`; public GitHub source.
- AI is a one-shot generator, not the AI chat feature. The writeup should say why: the product needs ABC out, not a conversation.
- A single-track piano roll.
- Title/meter/key/tempo are metadata synced with the ABC headers, not piano-roll edits.
- Chord symbols become real notes in the roll, and the roll writes notes back. The round trip doesn't have to give back identical ABC.
- AI first, then the piano roll (done).
- **Interpreted by the agent; Xuyan may change these:**
  - A key change keeps the pitches and re-spells them; it does not transpose.
  - Stop keeps the playhead where it is.

## 5. Gotchas learned the hard way

- **Deploy output** goes to the scratchpad, never into the repo. A file inside the repo makes the release dirty.
  - Command: `npx deepspace deploy --json > <scratchpad>/deploy.json 2>&1`
- **Server-side records check:** write `{"collection":"clips"}` to a file in the scratchpad, then
  `npx deepspace agent invoke midishare records_query --input-file <that file>`.
  - `records_delete` cleans up.
  - `npx deepspace logs --since 10m` shows server errors.
- **abcjs ties inside chords:** abcjs only follows a tie inside a chord into a next chord that has the tied note at the same position. That's why the writer uses voices; don't go back to `[CE-] E`-style output.
- **abcjs `onEnded`** also fires on a manual stop (Web Audio `onended`). `use-playback.ts` detects the end from the duration `prime()` returns.
- **AI credits:** an unset `maxOutputTokens` reserves 64k tokens of credits up front and fails with 402. Keep the 2000 cap.
- **Built-in browser pane:**
  - The screenshot frame isn't the same size as the CSS viewport; it was 800px wide against 1056–1297 CSS px. Scale coordinates, or use refs from `find`/`read_page`.
  - For timing-sensitive checks, drive the buttons from one in-page script; separate tool calls add seconds of latency.
  - When the pane is hidden, audio and animation may be throttled.
- **Sign-in:** Xuyan is signed in on midishare.app.space in the built-in browser. The agent never signs in or creates accounts.
- **Build log:** keep updating docs/BUILD_LOG.md as you go. Insert rows before the `\nTypes:` line. Use the row types `decision`, `agent`, `verified`, `changed-by-me`, `deploy`, `issue`.
