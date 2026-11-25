# midishare

Share short musical clips as text, and move them in and out of your DAW with copy and paste. Built on [DeepSpace](https://docs.deep.space) for the DeepSpace SWE Intern (Summer 2027) build exercise.

**Live:** https://midishare.app.space

A clip here is [ABC notation](https://abcnotation.com/), a plain-text music format. The same string is the database row, the AI's output and what goes on the clipboard. That is what lets a clip leave the browser: with [MIDI Clipboard](https://github.com/huangxuyan1/midi-clipboard/releases/latest), my add-on for Ableton Live, **Copy ABC** here and one shortcut in Live put the notes in a MIDI clip, and a copy in Live pastes back into the editor here. No file is exported or dragged.

What you hear is rendered in the browser by [Modular](https://github.com/huangxuyan1/Modular), my own audio graph runtime, written in C++ and compiled to WebAssembly, playing a piano soundfont. [abcjs](https://www.abcjs.net/) draws the sheet music and writes the `.mid` file.

## Try it

1. Open https://midishare.app.space/home. Published clips are readable without signing in: open one, press Play, download the `.mid`, press **Copy ABC**.
2. With MIDI Clipboard installed, press Ctrl+Shift+V in Ableton Live (Cmd+Shift+V on a Mac). The clip's notes are in your MIDI clip. Select notes in Live and press Ctrl+C (Cmd+C) to bring them back as ABC. https://midishare.app.space/ableton has the steps. Everything below works without Ableton.
3. Sign in, then choose **New clip**.
4. Paste ABC, or type a prompt into **Ask the AI** (for example "4-bar lo-fi chord progression in D minor"), or choose **Import MIDI** and pick a `.mid` file, or double-click the piano roll to add notes.
5. Press Play above the piano roll. Save a draft, or publish.
6. On your clip's page: Edit, Publish/Unpublish, Delete. On anyone's clip: **Make a variation** opens the editor with that clip's ABC.
7. Set a display name in **Settings** to sign your clips. Without one they show "by Anonymous".

## What it does

| Area | What | Main files |
|---|---|---|
| Data | The `clips` collection: title, description, tags, abc, status (`draft`/`published`), source (`pasted`/`ai`). The server caps every field's length. | `src/schemas/clips-schema.ts` |
| Permissions | Anyone, signed in or not, reads published clips. Signed-in users create clips and update or delete their own. A draft is visible only to its owner. The app owner can delete any clip. | same file |
| Profiles | A `profiles` collection: one optional display name per user, at most 40 characters. Without one, a user's clips show "by Anonymous". Everyone reads profiles, and a user writes only their own. A user reads only their own row in `users`. | `src/schemas/profiles-schema.ts`, `users-schema.ts`, `src/lib/profiles.ts` |
| Browse | `/home`: published clips newest first, with search by title or tag. Each card names who made the clip. | `src/pages/(app)/home.tsx` |
| People | `/me` (**My clips**): your own clips, drafts included. `/u/:id`: a named person's published clips. The display name is set in Settings. | `src/pages/(app)/(protected)/me.tsx`, `settings.tsx`, `src/pages/(app)/u/[id].tsx`, `src/components/ProfileView.tsx` |
| Clip page | `/clips/:id`: a read-only piano roll with the same transport as the editor, sheet music, Download .mid, Copy ABC, Make a variation, and the owner's actions. | `src/pages/(app)/clips/[id].tsx`, `src/components/ClipPlayer.tsx`, `AbcView.tsx` |
| Ableton round trip | **Copy ABC** puts a clip on the clipboard, MIDI Clipboard pastes it into a clip in Live, and notes copied in Live paste into the editor as ABC. The site's part is the shared format: validation accepts the lengths the add-on writes (such as `z5`), "Line up voices" repairs voices written on different numbers of lines, and the site and the add-on read ties and chord symbols the same way. `/ableton` has the steps and links to the latest release and the install guide. | `src/pages/(app)/ableton.tsx`, `src/lib/abc.ts`, `abc-voices.ts`, `abc-notes.ts` |
| Sound | Play and the note preview are rendered by Modular, my own audio graph runtime, compiled from C++ to a 109 KB WebAssembly module, with a piano soundfont. The clip goes in as the same MIDI bytes that Download .mid writes. Modular renders it whole into one stereo buffer, and Web Audio plays that buffer, so seeking and stopping stay in the browser. abcjs's built-in synth is the backup when Modular cannot load or rejects a clip. | `src/lib/audio-engine.ts`, `modular-engine.ts`, `modular-piano.ts`, `midi-velocity.ts`, `src/modular/`, `src/assets/piano/` |
| Editor | `/new` and `/edit/:id`. The ABC text is the single source of truth. The piano roll, the title/tempo/meter/key fields and the sheet music are views of it that write back to it. | `src/components/ClipForm.tsx`, `MetadataFields.tsx` |
| Piano roll | SVG, 16th-note grid, C2–B6. Double-click adds a note, drag moves it, drag either end to resize, double-click a note to delete it. A ruler of bar numbers runs along the top. Pointing at a note shows its name; pressing it plays its pitch, and dragging it plays each pitch it passes. Read-only on the clip page. | `src/components/PianoRoll.tsx`, `src/lib/note-preview.ts` |
| Transport | Play, Stop, Reset, a bar.beat counter and a moving playhead. In a clip wider than the view, the playhead stays in the middle while the roll slides under it. Click or drag in the roll's ruler to move the playhead; a playing clip carries on from where it is dropped. The space bar toggles play/stop. | `src/lib/use-playback.ts`, `src/components/Transport.tsx` |
| ABC ↔ notes | ABC → notes uses abcjs's own audio data, so the roll shows what you hear. Notes → ABC writes chords, ties and extra voices. | `src/lib/abc-notes.ts`, `src/lib/abc-headers.ts` |
| MIDI import | **Import MIDI** in the editor reads a `.mid` file in the browser and replaces the clip with its notes, written as ABC. All tracks are merged into one, the drum channel is skipped, and the first tempo and time signature are kept. | `src/lib/midi-import.ts` |
| AI assistant | `POST /api/abc/generate`: sign-in required, capped prompt, one model call through DeepSpace's AI proxy. The reply must parse as ABC; if it doesn't, the model gets one retry with the parser's errors. | `src/server/abc-routes.ts`, `src/components/AiAssist.tsx` |
| Validation | ABC is valid when it has a `K:` line, abcjs finds music, and abcjs reports no warnings. One warning is allowed: a length that isn't one written note value (`z5`), which is legal ABC. Voices must also be in step: abcjs matches voices by text line, so voices with different numbers of music lines are refused, and the editor offers a "Line up voices" button that rewrites them four bars per line. The editor and the AI route use the same check. | `src/lib/abc.ts`, `src/lib/abc-voices.ts` |
| Themes | Studio (dark, the default) and Daylight (light), switched with the sun/moon button in the top bar. The choice is kept in the browser. | `src/themes.css`, `src/themes.ts`, `src/components/ThemeToggle.tsx` |

## DeepSpace features used

- **Auth.** Sign-in, and the verified JWT that the AI route checks.
- **Records with realtime sync.** Clips are read with `useQuery` and written with `useMutations`. The pages use the confirmed mutations, so a write the server refuses shows up as an error instead of a false success.
- **Permissions (RBAC).** Ownership is the record's server-set `createdBy`, with `'own'` rules for update and delete and a `visibilityField` for drafts. The UI hides buttons only for convenience; the RecordRoom makes the decision. `profiles` uses the same `'own'` rules, and `users` is set to `roster: 'read-policy'` so that a user reads only their own account row.
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
npx vitest run             # 97 unit tests: clip and profile permissions, ABC validation, ABC <-> notes, voices, note preview, MIDI import, the audio engines, undo history
npx deepspace test run all # adds the 26 Playwright tests: 9 smoke, 2 API, 15 signed-in. The signed-in ones need two DeepSpace test accounts
```

The two-user test in `tests/collab.spec.ts` is the proof of ownership: user B's direct server calls to read A's draft, or to edit, unpublish or delete A's clips, come back `READ DENIED`, `UPDATE DENIED` and `DELETE DENIED`.

## Known limits

- **ABC only.** No velocity and no timing finer than a 16th note.
- **MIDI import keeps the notes, not the performance.** Starts and ends snap to 16th notes, so triplets and swing are straightened. Velocity, instruments and later tempo changes are dropped, notes outside C2–B6 move by octaves, and the key is set to C (choose another key to re-spell the notes). A file too long for one clip (5000 characters of ABC) is cut at a bar line, and the editor says how many bars it kept. The import trusts the file's own beat grid: a free-time recording (played without a click, saved at the default 120 BPM) has no usable grid, so its rhythm comes out uneven.
- **Editing in the piano roll rewrites the music lines.** Chord symbols such as `"Dm"` become written-out notes, and overlapping notes move into extra voices. The result plays the same but is not the same text.
- **One track.** The roll has a single lane of notes, C2–B6.
- **A key change re-spells the notes; it does not transpose.** In keys without flats, B♭ is written as `^A`.
- **Browse and search run in the browser** over every clip the server lets the caller read. That is fine for a small site and would need server-side filtering and paging for a large one.
- **The sound is a piano only, and the first sound needs a download.** Play and the note preview are rendered in the browser by Modular, my own audio engine, compiled to WebAssembly and playing a piano soundfont. The first Play or pressed note downloads the engine and the piano (about 8 MB). Every MIDI channel plays the piano, with no reverb. The site softens the beat accents that abcjs writes into the MIDI, so the downloaded `.mid` has stronger accents in other SoundFont players than Play has here. If Modular cannot load or rejects a clip, abcjs's built-in synth plays it, with piano samples from a third-party host. The site holds a hand-copied build of Modular; `src/modular/MANIFEST.txt` records which commit.
- **The AI assistant writes at most 16 bars** and spends the signed-in user's DeepSpace credits.
- **The Ableton add-on** ([midi-clipboard](https://github.com/huangxuyan1/midi-clipboard), a separate project of mine) is not part of this repo. It copies a MIDI clip in Ableton Live as ABC text and pastes ABC text back into Live, so a clip moves between Live and the site with one copy and one paste. That round trip was checked by hand and by ear, not by a test. Its first release, [MidiClipboard 1.0.0](https://github.com/huangxuyan1/midi-clipboard/releases/tag/v1.0.0), is for Windows and macOS, and plays a chord symbol such as `"Dm"` the way this site does. The site's [/ableton](https://midishare.app.space/ableton) page has the steps.

## Credits

- **Piano soundfont.** [`src/assets/piano/`](src/assets/piano) holds the "Yamaha Grand Piano" of FluidR3_GM by Frank Wen, under the MIT licence. The licence notice is `COPYING` in that folder, and the `.provenance.txt` file beside it records where the file came from and how it was made. The Modular audio engine plays it.

## How it was built

A coding agent (Claude Code) wrote the code under my direction; I made the product and architecture decisions. The record of that is in [`docs/`](docs):

- [BUILD_LOG.md](docs/BUILD_LOG.md): each decision, what the agent built, what was verified and how, and the bugs found on the live site.
- [HANDOFF.md](docs/HANDOFF.md): the brief the agent started from.
- [SESSION_HANDOFF.md](docs/SESSION_HANDOFF.md): the state and to-do list passed between agent sessions.
- [MODULAR_AUDIO_ENGINE.md](docs/MODULAR_AUDIO_ENGINE.md): the plan for the change of audio engine, written before it was built.

[CLAUDE.md](CLAUDE.md) holds the working rules the agent follows, and [AGENTS.md](AGENTS.md) is the DeepSpace scaffold's own agent guide.
