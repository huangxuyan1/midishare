# midishare

A site for sharing short musical clips as [ABC notation](https://abcnotation.com/). Built on [DeepSpace](https://docs.deep.space) for the DeepSpace SWE Intern (Summer 2027) build exercise.

**Live:** https://midishare.app.space

ABC is the one format everywhere: it is what's stored, what the AI writes, and what goes on the clipboard. The browser turns it into sheet music, sound and a `.mid` file with [abcjs](https://www.abcjs.net/).

## Try it

1. Open https://midishare.app.space/home. Published clips are readable without signing in: open one, press Play, download the `.mid`, copy the ABC.
2. Sign in, then choose **New clip**.
3. Type a prompt into **Ask the AI** (for example "4-bar lo-fi chord progression in D minor"), or paste ABC, or double-click the piano roll to add notes.
4. Press Play above the piano roll. Save as a draft, or publish.
5. On your clip's page: Edit, Publish/Unpublish, Delete. On anyone's clip: **Make a variation** opens the editor with that clip's ABC.

## What it does

| Area | What | Main files |
|---|---|---|
| Data | One `clips` collection: title, description, tags, abc, status (`draft`/`published`), source (`pasted`/`ai`). The server caps every field's length. | `src/schemas/clips-schema.ts` |
| Permissions | Anyone, signed in or not, reads published clips. Signed-in users create clips and update or delete their own. A draft is visible only to its owner. The app owner can delete any clip. | same file |
| Browse | `/home`: my clips, and published clips newest first, with search by title or tag. | `src/pages/(app)/home.tsx` |
| Clip page | `/clips/:id`: a read-only piano roll with the same transport as the editor, sheet music, Download .mid, Copy ABC, Make a variation, and the owner's actions. | `src/pages/(app)/clips/[id].tsx`, `src/components/ClipPlayer.tsx`, `AbcView.tsx` |
| Editor | `/new` and `/edit/:id`. The ABC text is the single source of truth. The piano roll, the title/tempo/meter/key fields and the sheet music are views of it that write back to it. | `src/components/ClipForm.tsx`, `MetadataFields.tsx` |
| Piano roll | SVG, 16th-note grid, C2–B6. Double-click adds a note, drag moves it, drag the right edge to resize, double-click a note to delete it. Read-only on the clip page. | `src/components/PianoRoll.tsx` |
| Transport | Play, Stop, Reset, a bar.beat counter and a moving playhead. The space bar toggles play/stop. | `src/lib/use-playback.ts`, `src/components/Transport.tsx` |
| ABC ↔ notes | ABC → notes uses abcjs's own audio data, so the roll shows what you hear. Notes → ABC writes chords, ties and extra voices. | `src/lib/abc-notes.ts`, `src/lib/abc-headers.ts` |
| AI assistant | `POST /api/abc/generate`: sign-in required, capped prompt, one model call through DeepSpace's AI proxy. The reply must parse as ABC; if it doesn't, the model gets one retry with the parser's errors. | `src/server/abc-routes.ts`, `src/components/AiAssist.tsx` |
| Validation | ABC is valid when it has a `K:` line, abcjs finds music, and abcjs reports no warnings. One warning is allowed: a length that isn't one written note value (`z5`), which is legal ABC. Voices must also be in step: abcjs matches voices by text line, so voices with different numbers of music lines are refused, and the editor offers a "Line up voices" button that rewrites them four bars per line. The editor and the AI route use the same check. | `src/lib/abc.ts`, `src/lib/abc-voices.ts` |

## DeepSpace features used

- **Auth.** Sign-in, and the verified JWT that the AI route checks.
- **Records with realtime sync.** Clips are read with `useQuery` and written with `useMutations`. The pages use the confirmed mutations, so a write the server refuses shows up as an error instead of a false success.
- **Permissions (RBAC).** Ownership is the record's server-set `createdBy`, with `'own'` rules for update and delete and a `visibilityField` for drafts. The UI hides buttons only for convenience; the RecordRoom makes the decision.
- **Server-side AI.** `createDeepSpaceAI` with the caller's JWT. The repo holds no API key, and the signed-in user's credits pay for the call. `maxOutputTokens` is capped at 2000.
- **Agent tools.** The scaffold's record tools (`registerAgent`) stay mounted. `npx deepspace agent invoke midishare records_query` was the way to check on the live app what the server really stores and refuses.
- **Deploys** to `midishare.app.space`, with GitHub as the source.

## DeepSpace features not used, and why

- **AI chat (the full feature with saved history).** The product needs ABC out, not a conversation. A one-shot route is smaller, easier to validate, and has a fixed cost per request.
- **Collaborative editing (Yjs).** A clip is a few bars owned by one person. "Make a variation" covers building on someone else's idea.
- **Payments.** Nothing here is worth charging for.
- **File storage.** A clip is under 5000 characters of text. The `.mid` file is made in the browser when you ask for it.
- **Scheduled jobs, background jobs, presence, messaging, external integrations.** No feature needs them.

The scaffold's Durable Objects for these (Yjs, canvas, presence, cron, jobs) are still declared in `worker.ts`, because removing a deployed Durable Object class needs a migration. They are unused scaffold code, not features of this app. The scaffold's AI chat routes and its `/api-status` debug page were removed.

## Run it

Needs Node 22.15+ or 24, and npm 11.6+.

```bash
npm install
npx deepspace auth login   # browser sign-in, once
npm run dev                # http://localhost:5173
```

`wrangler.toml` carries the id of the deployed app, which belongs to the author's DeepSpace account.

Checks:

```bash
npx tsc --noEmit
npx eslint src
npx vitest run             # 48 unit tests: schema permissions, ABC validation, ABC <-> notes, voices, undo history
npm run test:e2e           # 16 Playwright tests; the signed-in ones need two DeepSpace test accounts
```

The two-user test in `tests/collab.spec.ts` is the proof of ownership: user B's direct server calls to read A's draft, or to edit, unpublish or delete A's clips, come back `READ DENIED`, `UPDATE DENIED` and `DELETE DENIED`.

## Known limits

- **ABC only.** No velocity, no timing finer than a 16th note, and no `.mid` import. Importing MIDI and converting it to ABC is the next step.
- **Editing in the piano roll rewrites the music lines.** Chord symbols such as `"Dm"` become written-out notes, and overlapping notes move into extra voices. The result plays the same but is not the same text.
- **One track.** The roll has a single lane of notes, C2–B6.
- **A key change re-spells the notes; it does not transpose.** In keys without flats, B♭ is written as `^A`.
- **Browse and search run in the browser** over every clip the server lets the caller read. That is fine for a small site and would need server-side filtering and paging for a large one.
- **The sound is abcjs's built-in synth.** It downloads piano samples from a third-party host when you press Play. Replacing it with my own audio engine is planned: see [docs/MODULAR_AUDIO_ENGINE.md](docs/MODULAR_AUDIO_ENGINE.md).
- **The AI assistant writes at most 16 bars** and spends the signed-in user's DeepSpace credits.
- **The Ableton bridge** ([midi-clipboard](https://github.com/huangxuyan1/midi-clipboard), a separate project) is not part of this repo. It copies a MIDI clip in Ableton Live as ABC text and pastes ABC text back into Live, so a clip moves between Live and the site with one copy and one paste. That round trip was checked by hand, not by a test.

## How it was built

A coding agent (Claude Code) wrote most of the code under direction. The record of that is in [`docs/`](docs):

- [BUILD_LOG.md](docs/BUILD_LOG.md): each decision, what the agent built, what was verified and how, and the bugs found on the live site.
- [HANDOFF.md](docs/HANDOFF.md): the brief the agent started from.
- [SESSION_HANDOFF.md](docs/SESSION_HANDOFF.md): the state and to-do list passed between agent sessions.
- [SUBMISSION.md](docs/SUBMISSION.md): the submission note.
- [MODULAR_AUDIO_ENGINE.md](docs/MODULAR_AUDIO_ENGINE.md): a planned change of audio engine, not built.

[CLAUDE.md](CLAUDE.md) holds the working rules the agent follows, and [AGENTS.md](AGENTS.md) is the DeepSpace scaffold's own agent guide.
