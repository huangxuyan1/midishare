# Session handoff — end of session 3, 2026-11-23

For the next agent session. Read this first, then [CLAUDE.md](../CLAUDE.md) (working rules). Open [HANDOFF.md](HANDOFF.md) (the original brief) and [BUILD_LOG.md](BUILD_LOG.md) (everything done, with how it was verified) when you need the detail.

**Hard deadline: Tue Nov 24, 2026, 11:59 PM ET** (confirmed from the invite email). Xuyan submits in the careers portal. The agent never submits.

## 1. Where things stand

The app is finished and submittable. What is left is Xuyan's own checking and the submission note.

- **Live:** https://midishare.app.space (app `midishare`, id `app_01M7VPXYB581QQY5JXH4RF7NAN`).
  - Latest release: `rel_01M86CTPKEBJG8A1P56T420SQF`, commit `ca03f10` (session 4), `dirty: false`. Every commit after it changes only docs.
- **Repo:** public GitHub `huangxuyan1/midishare`, branch `main`. Everything is committed and pushed.
  - The DeepSpace source is GitHub. **Never run `deepspace push`.**
- **Data:** 5 published example clips written by the agent (record ids `example-*`, source `ai`), owned by Xuyan. Xuyan had not listened to them when they were published.
- **Tests:** 63 unit tests and 21 Playwright tests pass. Type-check and lint are clean.
  - `npx tsc --noEmit`, `npx eslint .`, `npx vitest run`
  - `npx deepspace test run all --port 5187` (port 5173 belongs to another dev server; don't kill it)
- **Test accounts:** "Test A" and "Test B" exist. The Playwright fixture signs them in from the CLI's saved credentials.
- **Skills:** the DeepSpace skill and the 39 Matt Pocock skills are in `.claude/skills/` (gitignored). `skills-lock.json` lists them and is committed.

## 2. To do

1. **Xuyan, by ear.** Press Play in the editor and on a clip page. Confirm that sound comes out and that it lines up with the playhead. Try the space bar. Listen to the five example clips; unpublish or delete any that sound wrong.
2. **Xuyan, the submission note.** Edit [SUBMISSION.md](SUBMISSION.md) and resolve its two TODO lines (the by-ear check, and any code Xuyan changed by hand). Then submit in the portal: live URL, repository, note.
3. **After any code change:** run the checks, commit, deploy, and confirm `dirty: false`. Verify the changed path on the live URL. Add rows to BUILD_LOG.md.
4. **Done in session 3: the Studio UI.** Xuyan looked at it and approved it ("really, really cool"). Changes to colours, fonts or layout go through `src/themes.css` (the `studio` block), `src/styles.css` (app tokens) and the page files in the table below.
5. **Done in session 4: ABC from the MIDI Clipboard bridge.** Lengths like `z5` are accepted, and voices with different numbers of lines get a "Line up voices" button in the editor. `lineUpVoices` returns null (no button, only the message) when the music has lyrics, comments, mid-tune fields or inline `[V:]` marks. The agent did not change the bridge.
6. **Optional polish**, only if Xuyan asks:
   - `/new` starts with an empty title while the example ABC has `T:Example`
   - in keys without flats (C, Am…), B♭ is spelled `^A`
7. **Set aside, separate tasks:**
   - **Modular as the audio engine: built on 2026-11-24** (branch `modular-audio-engine`). `src/lib/audio-engine.ts` picks the engine: Modular with a piano soundfont, and the abcjs synth as backup. The Modular build in `src/modular/` is a hand-copied stopgap from Modular commit `00bfcac`; a newer, hardened CI build exists (artifact `modular-web-54612acab62e2a9dde8e5d3775567e61f5d35e04`), and replacing the stopgap with it needs Xuyan's approval of the download. Not built: sending clips with drums or with abcjs MIDI-writer defects to the abcjs synth, loading Modular before the first Play, rendering in a Web Worker. [MODULAR_AUDIO_ENGINE.md](MODULAR_AUDIO_ENGINE.md) is the earlier plan.
   - **The Ableton bridge now copies and pastes ABC** (`C:\Users\alvin\Documents\Projects\midi-clipboard`). Xuyan did this outside this folder (bridge commit `5d60b4d`, not pushed to GitHub when checked on 2026-11-24) and tested both directions by hand on 2026-11-24: a clip copied in Live pastes into the editor, and a clip's ABC copied from the site pastes into Live.

## 3. What the app does

| Area | What | Main files |
|---|---|---|
| Data | `clips` collection: title, description, tags (comma text), abc, status `draft`/`published`, source `pasted`/`ai`. Server-side maxLength (title 100, description 1000, tags 200, abc 5000). | `src/schemas/clips-schema.ts` (+ `.test.ts`) |
| Permissions | Anyone, including signed-out viewers, reads `published` clips. Members create, and update/delete their own (`'own'`). Admins can delete any clip. Drafts are visible only to their owner (`visibilityField` on status). | same |
| Landing | `/`: static, prerendered. A Design Direction comment at the top of the file, the headline, a demo clip with a CSS playhead sweep, a numbered list, a closing link. No hardcoded colours in JSX. | `src/pages/index.tsx`, `src/components/landing/` (+ test), `src/seo.ts` |
| Library | `/home`: My clips + Published as cards, newest first, `?q=` (title/tag) and `?tag=`. Each card has a mini piano roll that runs a silent preview on hover. Signed-out visitors see the same library and a sign-in line. | `src/pages/(app)/home.tsx`, `src/components/ClipCard.tsx`, `MiniRoll.tsx` |
| Clip page | `/clips/:id`: transport and read-only piano roll in one panel, tabs for sheet music and ABC text, Copy ABC, Download .mid, Make a variation. Owner: Edit, Publish/Unpublish, Delete (the dialog names the clip). | `src/pages/(app)/clips/[id].tsx`, `src/components/ClipPlayer.tsx` |
| Editor | `/new`, `/new?from=<id>` (variation), `/edit/:id`. The ABC text is the single source of truth. The piano roll, the title/tempo/meter/key fields and the sheet preview are views that write back to it. Each clip gets its own form instance (`key`). Undo/redo covers every field: the form's values live in a history, a burst of typing is one step, and Ctrl+Z / Ctrl+Y work next to the Undo and Redo buttons. | `src/components/ClipForm.tsx`, `MetadataFields.tsx`, `src/lib/history.ts` (+ test) |
| Piano roll | SVG, 16th grid, C2–B6. Double-click adds a note; drag moves it; dragging either end resizes it (the cursor is a left-right arrow there; `zoneAt` decides); double-clicking a note deletes it. A sticky ruler of bar numbers on top: click or drag in it to move the playhead (`onSeek`, `onSeekEnd`). Note preview: a tag names the note under the pointer; pressing a note plays its pitch and dragging plays each new pitch (`playPreview`, one at a time, silent while the clip plays). Read-only when `onChange` is left out; names and sounds still work there. | `src/components/PianoRoll.tsx`, `src/lib/note-preview.ts` (+ test) |
| MIDI import | "Import MIDI" in the editor's toolbar. `readMidi` parses the .mid bytes (all tracks merged, drum channel skipped, first tempo and time signature, notes snapped to 16ths and moved by octaves into C2-B6); `midiToAbc` writes them with `notesToAbcBody` and keeps as many bars as fit in 5000 characters. The import is one undo step; a message under the roll says what was imported or why not. | `src/lib/midi-import.ts` (+ test), `src/components/ClipForm.tsx` |
| Transport | Play / Stop (keeps the playhead) / Reset, `seek` / `endSeek` for dragging the playhead (a playing clip carries on from where it is dropped), bar.beat counter, amber playhead, sounding notes turn amber. While playing, the playhead stays in the middle of the view and the roll slides under it (the effect in `PianoRoll.tsx` that sets `scrollLeft`); the view returns to the start with the playhead. The space bar toggles play/stop. Used by the editor and the clip page. | `src/lib/use-playback.ts`, `src/components/Transport.tsx` |
| Sheet music | abcjs rendering only; it has no player of its own. | `src/components/AbcView.tsx` |
| ABC ↔ notes | ABC → notes via abcjs `setUpAudio`. Notes → ABC: same start and length form a chord; overlapping chords go into separate voices. Lengths are split into writable values and tied. | `src/lib/abc-notes.ts`, `src/lib/abc-headers.ts` (+ tests) |
| AI assistant | `POST /api/abc/generate` (JWT required, prompt ≤500, currentAbc ≤5000). `createDeepSpaceAI(env,'anthropic',{authToken})`, `maxOutputTokens: 2000`. Validated with `checkAbc`, retried once with the errors, then 502. | `src/server/abc-routes.ts`, `src/components/AiAssist.tsx` |
| Validation | `checkAbc`: requires a `K:` line, at least one parsed line, zero abcjs warnings. The "Duration not representable" warning is ignored: lengths like `z5` are legal ABC, play correctly, and the sheet draws the nearest shape. Voices must be in step: every line of music must have the same voices, because abcjs matches voices by text line. The editor offers "Line up voices" (`lineUpVoices`), which rewrites the music four bars per line with every voice in each group and pads short voices with `Z` bars. | `src/lib/abc.ts`, `src/lib/abc-voices.ts` (+ test) |
| Record tools | `registerAgent` mounts the record tools under `/_deepspace/agent`. `deepspace agent invoke` and the two-user test use them. | `src/ai/agent.ts`, `src/ai/tools.ts` |
| Tests | Unit: schema permissions, ABC validation, ABC ↔ notes, undo history. Playwright: smoke, API, two-user ownership, editor undo/redo, odd lengths, lining up voices, dragging the playhead, the centred playhead during playback, resizing from either end, note preview, MIDI import, read-only roll. | `src/**/*.test.ts`, `tests/` |

Sound comes from Modular, Xuyan's audio graph runtime, compiled to WebAssembly and playing a piano soundfont (`src/lib/modular-engine.ts`, `src/modular/`, `src/assets/piano/`). The first sound downloads the module and the piano (about 7.5 MB) from the site itself. When Modular fails, the abcjs synth plays, with piano samples from a third-party host. The engine is chosen in `src/lib/audio-engine.ts`.

### Design

- **Themes:** `studio` (dark, the default) and `daylight` (light, added 2026-11-24), both in `src/themes.css`. Studio: warm near-black panels and one amber accent. Amber marks what is playing and the main action; a resting note is pale. Daylight: cool gray panels, a teal accent in place of amber, mid-gray resting notes that turn teal while they sound.
- **Theme switch:** the sun/moon button (`ThemeToggle`) in the top bar and on the landing page. `src/themes.ts` sets `data-theme` on `<html>` and saves the choice in localStorage (`midishare-theme`); a script in `index.html` applies it before the first paint. A first visit is always dark; the system setting is not read.
- **Fonts:** IBM Plex Sans and IBM Plex Mono, loaded from Google Fonts in `index.html`. Mono is for the headline, small labels (`LEGEND` in `src/lib/utils.ts`), counters and ABC text.
- **App tokens** (piano roll, note, keyboard) are in the `@theme` block of `src/styles.css`, so classes like `bg-roll` and `fill-note` exist. Those are the dark values; the `daylight` block overrides them.
- **Rules followed**, from docs.deep.space/design: no hardcoded colours in the landing files, kit primitives instead of browser defaults (`Select`, tooltips via `Tip`, `ConfirmModal`, `EmptyState`), `/* home pattern: … */` as the first line of `home.tsx`. The gate greps are in BUILD_LOG.md.

## 4. Decisions already made by Xuyan (don't reopen)

- App name `midishare`; public GitHub source.
- AI is a one-shot generator, not the AI chat feature. The product needs ABC out, not a conversation.
- A single-track piano roll.
- Title/meter/key/tempo are metadata synced with the ABC headers, not piano-roll edits.
- Chord symbols become real notes in the roll, and the roll writes notes back. The round trip doesn't have to give back identical ABC.
- The clip page shows the piano roll too, read-only.
- The space bar toggles play/stop.
- Undo/redo in the editor.
- The UI direction is "Studio (dark DAW)".
- Repo cleanup: process docs live in `docs/`; the unmounted AI chat routes and the `/api-status` page are removed; the installed skill copies are gitignored.
- The Modular audio engine is in use since 2026-11-24. The gain (3), the softened accents and the playhead stopping at the end of the music were settled with Xuyan by ear.
- **Chosen by the agent; Xuyan may change these:**
  - Inside the Studio direction: the exact colours, IBM Plex, no light mode (Xuyan asked for one on 2026-11-24, see Themes above), "New clip" as a button in the bar, Settings hidden when signed out.
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
- **abcjs remembers one tied chord at a time, across all voices.** A chord tied over a line break loses its tie when another voice's line, read in between, has a tied chord. The writer (`splitIntoVoices`) therefore never puts a note that crosses a line break into a chord.
- **abcjs ignores accidentals on the later pieces of a tied note.** After `^F2- | ^F2`, a plain `F` in the second bar plays F natural. The writer (`writeVoice`) does not count such an accidental for the rest of the bar, so the next F# gets its own `^`.
- **Pointer capture:** the piano roll captures the pointer on the dragged note, not on the SVG. Click and double-click go to the capturing element, so capturing on the SVG broke double-click-to-delete. Test mouse behaviour with real input (Playwright), not dispatched events.
- **abcjs `onEnded`** also fires on a manual stop. `use-playback.ts` detects the end from the duration `prime()` returns.
- **AI credits:** an unset `maxOutputTokens` reserves 64k tokens of credits up front and fails with 402. Keep the 2000 cap.
- **Screenshots:** the browser pane can be hidden, and then it gives no pictures. A temporary Playwright spec that calls `page.screenshot()` into the scratchpad works every time (delete the spec afterwards).
- **Line endings in scripts:** many files are CRLF on disk. Normalise to LF before matching text and write the original ending back.
- **Built-in browser pane:**
  - The screenshot frame isn't the same size as the CSS viewport. Use refs or in-page scripts instead of coordinates.
  - For timing-sensitive checks, drive the page from one in-page script.
  - When the pane is hidden, animation frames pause: a playhead sample can read as "not moving". Sample several times.
  - To move between app URLs without a page load: `history.pushState` then dispatch a `popstate` event.
- **Sign-in:** Xuyan is signed in on midishare.app.space in the built-in browser. The agent never signs in or creates accounts.
- **Build log:** insert rows before the `\nTypes:` line of `docs/BUILD_LOG.md`. Row types: `decision`, `agent`, `verified`, `changed-by-me`, `deploy`, `issue`.
- **Line endings:** files are LF in the repo. When editing with a script, keep each file's existing line ending.
