# Submission note (draft)

> Draft written by the agent from [BUILD_LOG.md](BUILD_LOG.md). Xuyan edits and submits it.
> Lines marked **TODO** are not done yet; update or remove them before submitting.

- **Live URL:** https://midishare.app.space
- **Repository:** https://github.com/huangxuyan1/midishare

## What I built

midishare is a site for sharing short musical clips as ABC notation. ABC is the single format: it is what the database stores, what the AI writes, and what you copy to the clipboard.

- It has its own design, a dark "studio" look with one amber accent, built after reading DeepSpace's design docs. The scaffold's placeholder theme is gone.
- Browse and search published clips without signing in. Each card shows the clip as a small piano roll, and hovering runs a silent preview. Each clip page shows a piano roll and sheet music, plays in the browser with a moving playhead, downloads as a `.mid` file and copies as ABC text.
- Signed-in users create clips in an editor where the ABC text, a piano roll, the title/tempo/meter/key fields and the sheet music all show the same clip. Editing any of them updates the others. Undo and redo cover every change.
- A transport above the piano roll plays the clip with a moving playhead. Dragging in the roll's ruler of bar numbers moves the playhead, also while the clip plays. Pointing at a note shows its name, pressing it plays its pitch, and dragging it up or down plays each pitch it passes.
- **Import MIDI** reads a `.mid` file in the browser and turns its notes into ABC: all tracks merged into one, snapped to 16th notes.
- An AI assistant turns a prompt into ABC, or writes a variation of the current clip. The server only returns ABC that parses.
- Clips are drafts until published. Only the owner can edit, unpublish or delete a clip.

## DeepSpace integrations

**Used**

- **Auth** for sign-in, and its verified JWT to protect the AI route.
- **Records with realtime sync** (`useQuery`, `useMutations`) for the one `clips` collection. The pages use confirmed mutations, so a write the server refuses is shown as an error.
- **Permissions (RBAC).** The owner is the record's server-set `createdBy`, so a client cannot claim someone else's clip. Update and delete are `'own'`, drafts are hidden from everyone else with `visibilityField`, and signed-out visitors can read published clips. The server caps every field's length.
- **Server-side AI** through `createDeepSpaceAI` with the caller's JWT. There is no API key in the repo or the client, and the signed-in user's credits pay for the call.
- **Agent tools** (`registerAgent`, from the scaffold), used through `npx deepspace agent invoke` to check on the live app what the server stores and refuses.
- **Deploys** to `midishare.app.space`, with a public GitHub repo as the source.

**Left out**

- **The AI chat feature.** The product needs ABC out, not a conversation. A one-shot route is easier to validate and has a bounded cost: the output is capped at 2000 tokens with at most one retry.
- **Collaborative editing.** A clip is a few bars with one owner. "Make a variation" covers building on someone else's clip.
- **Payments.** Nothing here is worth charging for.
- **File storage.** A clip is under 5000 characters of text, and the `.mid` file is generated in the browser.
- **Scheduled jobs, presence, messaging, external integrations.** No feature needs them.

## Main tradeoff

**ABC as the only format.**

- What it gives: one small text format that people can read, an LLM can write, a parser can validate, and a clipboard can carry. The same string is the database row, the AI output and the paste target.
- What it costs: no velocity and no timing finer than a 16th note. An imported MIDI file keeps its notes but not its performance: triplets and swing are straightened.
- A second cost came with the piano roll. Writing notes back to ABC is lossy: chord symbols become written-out notes, and overlapping notes move into separate voices. The clip plays the same, but the text is not the same text. I accepted this, and kept the ABC text as the single source of truth so there is never a second copy to keep in sync.

## What the agent did

A coding agent (Claude Code) wrote most of the code. I made the product and architecture decisions and directed it. BUILD_LOG.md was kept during the build, not written afterwards.

- **My decisions:** the idea and the ABC-everywhere design; a complete UI change in a "dark DAW" direction, after comparing the app with DeepSpace's examples; undo/redo; the app name and a public GitHub source; a one-shot AI generator instead of AI chat; AI first, then the piano roll; a single-track roll; title, meter, key and tempo as fields synced with the ABC headers; chord symbols shown as real notes in the roll; the DAW-style transport; a playhead that can be dragged; a note preview (name on hover, sound on press and while dragging, each new sound stopping the one before); resizing a note from either end; a playhead that stays in the middle while the roll slides; MIDI import that treats the file as one track.
- **The agent's work:** reading the DeepSpace skill and docs, the scaffold, the schema and permission rules, every page and component, the ABC ↔ notes converter, the AI route, the unit tests, the deploys, and the checks on the live site.
- **Defaults the agent chose and I left in place:** the exact colours and the IBM Plex fonts of the Studio design; admins can delete any clip; tags are comma-separated text; a key change re-spells the notes and does not transpose; Stop keeps the playhead where it is.
- **Bugs the agent found by testing the live site, then fixed:**
  - `hello` passed as valid ABC, because abcjs reads the "e" as a note. Validation now needs a `K:` line and zero parser warnings.
  - The first AI call failed with "Payment Required" with a full credit balance. An unset output limit reserves credits for 64k tokens; the limit is now 2000.
  - Adding one note in the roll turned 48 notes into 60. abcjs does not follow a tie inside a chord the way the writer assumed, so the writer now puts overlapping notes into separate voices.
  - Dragging a note did nothing, because the drag state lived in React state and the pointer events arrived before the re-render. It now lives in a ref.
  - Double-clicking a note did not delete it with a real mouse. The drag captured the pointer on the whole SVG, and the browser sends the double-click to the capturing element. Earlier checks had dispatched the event straight at the note; a Playwright test with real mouse input found it.

## How ownership was verified

- A Playwright test signs in two test accounts (`tests/collab.spec.ts`). User A creates a draft and a published clip. User B then calls the server directly, without the UI: the draft is `READ DENIED` and missing from B's query, and edit, unpublish and delete are `UPDATE DENIED` / `DELETE DENIED` on both clips. A reads both clips back unchanged. B's pages show no owner actions and no draft.
- The test fails when the rule is loosened: with member `update: true` in the schema, B's edit is accepted and the test goes red.
- A unit test checks the permission rules against the SDK's own `canRead`/`canUpdate`/`canDelete`.

## What I verified myself

- I signed in on the live site. The agent then drove the full path in my session: create, save as draft, publish, edit, unpublish, copy ABC, delete.
- I found the dark-mode bug where the piano roll's keyboard colors were inverted. The agent fixed it.
- I tested the app by hand: pasted ABC text parses correctly, and Play makes sound.
- I pressed Play and checked by ear that the sound lines up with the playhead. The agent cannot hear; it checked on the live site that the clip page's button returns to Play at the end.
- I reviewed the Studio design after the agent built it and kept it as it is.
- I pasted a clip exported from Ableton by my own bridge, and the editor rejected it for a `z5` rest (five eighths). The ABC standard allows such a length, so I decided the site must accept it. The agent changed the validation; the sheet music draws the nearest note shape. The same clip then played out of step, because abcjs matches voices by text line and my bridge had written one voice on fewer lines. I chose to fix that on the site too: the editor now refuses such ABC with an explanation and offers a "Line up voices" button that rewrites it.
- I imported a piano MIDI file from the web and saw an F in bar 10 that the song does not have. The agent compared the file's notes with the notes the imported ABC plays and found two bugs in its own notes-to-ABC writer, both from how abcjs reads ties: a sharp was lost after a note tied over a bar line, and a chord tied over a line break lost its tie. After the fix that file and 399 other MIDI files read back note for note. The same file's rhythm still looks uneven; that part is the file, a free-time recording with no usable beat grid.
- I tested the round trip with Ableton Live by hand. Ctrl+C on a MIDI clip in Live copies ABC text through my bridge, and it pasted into the editor. I then copied a clip's ABC from the site and pasted it into Live. Both worked.
- I did not change any code by hand. The agent wrote all of it.

## Not finished

- **The two-user ownership test ran on the local dev worker, not on the live URL.** It runs the same RecordRoom and schema as the deploy, but I did not repeat it with two accounts on midishare.app.space.
- **MIDI import is simple on purpose.** It merges all tracks, skips drums, keeps only the first tempo and time signature, sets the key to C, and cuts a file that is longer than one clip (5000 characters of ABC) at a bar line. The agent tested it with files it built and with 25 files from another project of mine, not with a wide range of files from other programs.
- **The sound engine was switched on the last day.** Play and the note preview now run through Modular, my own graph audio runtime, compiled to WebAssembly and playing a piano soundfont. abcjs's built-in synth, with piano samples from a third-party host, is the backup when Modular cannot load or rejects a clip. Before the deploy it was checked by the Playwright tests in Chromium, and I listened to it on a local server. Firefox could not be started by the test tool on my machine, and the WebKit build for Windows renders through Modular but has no Web Audio, so neither browser played sound in a test. It plays a piano only, with no reverb, and the first sound downloads about 7.5 MB. The build of Modular in the repo was copied in by hand; `src/modular/MANIFEST.txt` names the commit. The earlier plan is in `docs/MODULAR_AUDIO_ENGINE.md`.
- **The Ableton bridge is a separate project, and its round trip is checked by hand only.** My `midi-clipboard` project now copies a clip in Ableton Live as ABC and pastes ABC back into Live. No automated test covers a clip going from Live to the site and back.
- **Small edges:** `/new` starts with an empty title while the example ABC says `T:Example`; in keys without flats, B♭ is spelled `^A`; browse and search run in the browser, which is fine at this size.
- **Scaffold leftovers:** the scaffold's unused Durable Objects (Yjs, canvas, presence, cron, jobs) are still declared in `worker.ts`, because removing a deployed Durable Object class needs a migration. The scaffold's AI chat routes and debug page were removed.
