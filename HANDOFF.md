# Handoff: DeepSpace build exercise — ABC/MIDI clip sharing app

You are picking up a build task for Xuyan's DeepSpace Software Engineering Intern (Summer 2027) application. Your working scope is `C:\Users\alvin\Documents\Projects`. Create a new folder there for the app. Suggested name: `deepspace-midi-share`. Pick a final app name with Xuyan, because it becomes the deploy subdomain.

## 1. The assignment (from the DeepSpace careers portal)

**Hard deadline: Monday, Nov 24, 2026, 11:59 PM ET** (portal: `2026-11-25T04:59:59Z`). The invite went out on Nov 19.

Brief, paraphrased:
- Build and deploy a full-stack app on DeepSpace. The idea is the applicant's own. A focused, finished project beats a large, incomplete one. Choose a scope you can finish within the five-day window. If something is unfinished, say what you would do next.
- It must be interactive, with enough technical depth to show understanding of DeepSpace. Use integrations where they improve the product. There is no minimum count. Explain why you left out integrations that would not add value.
- A plain habit tracker is "usually not enough." Their examples of the expected level are StoryNest, ThreadHunt and RunningMap.
- Coding agents are allowed. They want to see how the applicant directs the agent, verifies its work and takes over when needed.
- **Submit in the portal:** live URL, repository, and a short note covering:
  - what was built
  - which DeepSpace integrations were used
  - the main tradeoff
  - what the agent did
  - what the applicant verified themselves
- The applicant owns the code. It is for evaluation only.

Grading expectations (from the brief's rubric):
- sensible scope for five days
- the deployed app works on its important path, and unfinished edges are explained honestly
- technical depth through working flows
- integration choices are justified
- code is understandable and **secrets are protected**
- **platform primitives are used instead of being reimplemented without a reason**
- the writeup covers the tradeoff, what the agent did, and what the applicant verified or changed
- size and hours are **not** rewarded, and originality is not scored

The next round is a live coding session. Xuyan must be able to explain and modify every part of the code. Keep it readable, and don't add clever abstractions they didn't ask for.

## 2. DeepSpace platform facts (verify against the docs before relying on them)

- Docs: https://docs.deep.space. Agent skill: https://github.com/deepdotspace/deepspace-skill. Examples: https://github.com/deepdotspace (read one or two before building).
- **Read the agent skill and the quickstart first.**
- It's a full-stack SDK on Cloudflare Workers. It includes:
  - auth
  - SQLite-backed records with real-time sync
  - per-collection role-based permissions (RBAC)
  - presence and messaging
  - file storage
  - AI chat (streamed Claude/GPT with tool use over records)
  - scheduled jobs, payments, and deploys to `<name>.app.space`
- **CLI.** The task brief and the docs show slightly different command forms, so check the docs:
  - scaffold: `npx deepspace` (brief) or `npm create deepspace@latest my-app` (docs)
  - local dev: `npx deepspace dev start`
  - deploy: `npx deepspace deploy`
- The scaffold includes a Vite + React frontend, a Hono worker, file-based routing, Tailwind v4 and a shadcn-style UI kit.
- **SDK entry points:**
  - `deepspace` (React hooks: `RecordProvider`, `useQuery`, `useMutations`, `useAuth`, plus integrations)
  - `deepspace/worker` (rooms, schemas, JWT verification, AI helpers)
  - `deepspace/testing` (multi-user Playwright fixture)
- Relevant doc pages:
  - `concepts/data-model`, `concepts/permissions`
  - `guides/authentication`, `guides/data-storage`, `guides/ai-chat`, `guides/server-actions`, `guides/secrets`, `guides/testing`
  - `sdk-reference/client/records`, `sdk-reference/client/integrations`
- An account is needed to deploy. **Xuyan does sign-in and account creation themself.** Don't create accounts or enter credentials.

## 3. Product: ABC-notation clip sharing

**Core idea:** a site where musicians share short musical clips as **ABC notation**. ABC is the one canonical format:
- what's stored
- what the AI generates
- what goes on the clipboard

Decisions already made with Xuyan (don't reopen them):
- **ABC everywhere**, using the **abcjs** library in the browser to:
  - render sheet music
  - play audio
  - export `.mid` for download

  No Modular/WASM audio engine, and no custom note format.
- **The DAW bridge already exists** as Xuyan's `midi-clipboard` project (an Ableton Live remote script plus `bridge.exe`). The website itself only needs paste-in and copy-out of ABC text, so reviewers can test it without Ableton. Switching the bridge to ABC is a separate workstream (section 5).
- **The AI assistant is the headline DeepSpace integration.**

### MVP (must ship and work on the deployed URL)
1. **Sign in** with DeepSpace auth.
2. **Create a clip:** paste ABC (with live preview: notation + play), add title, description and tags, then save as a draft or publish.
3. **Clip page:** rendered notation, play/stop, **Download .mid** (abcjs export), **Copy ABC**.
4. **Browse/search** published clips by title and tag. Newest first is fine.
5. **Ownership:** only the owner can edit, unpublish or delete. Enforce this with DeepSpace permissions, not just by hiding UI buttons.
6. **AI assistant**, built on DeepSpace's AI chat:
   - The user prompts, e.g. "4-bar lo-fi chord progression in D minor" or "a variation of this clip."
   - The model returns ABC.
   - The app **validates that it parses** (abcjs) before showing it as a playable draft. On failure, retry or show an error.
   - The user can then publish the draft.
   - Pass the current clip's ABC as context for variations.

### Out of scope (say so in the writeup with reasons)
- payments
- collaborative editing
- Modular/WASM playback
- `.mid` upload → ABC conversion (a good "next step")
- social features beyond what's cheap

Add likes or comments only if the MVP is done early and they come almost for free from records and realtime.

### Suggested data model (adjust to the SDK's schema conventions)
- `clips`:
  - `ownerId`, `title`, `description`, `tags`, `abc` (text)
  - `status` (`draft` | `published`)
  - `source` (`pasted` | `ai`)
  - created and updated timestamps
- Permissions:
  - anyone signed in (or the public, if supported) can read `published` clips
  - owners have full CRUD on their own clips
  - drafts are visible to the owner only

### Secrets and safety
- AI calls go through DeepSpace's AI helpers or server actions. Never put API keys in client code or in the repo. Use `guides/secrets`.
- Cap the size of ABC input and AI prompts.

## 4. Suggested schedule
- **Day 1 (Nov 20–21):** read the docs, skill and an example. Scaffold, deploy a hello-world to `.app.space` early, add the clips schema and permissions.
- **Day 2:** create/paste flow with abcjs preview, the clip page (render, play, `.mid` download, Copy ABC).
- **Day 3:** browse/search, owner edit/delete, polish, empty and error states.
- **Day 4:** AI assistant with validation, and variation from an existing clip.
- **Day 5 (Nov 24):**
  - multi-user test, using the `deepspace/testing` fixture or a manual check with two accounts
  - final deploy
  - README
  - submission note
  - Ableton demo video, if the bridge is ready

## 5. Separate workstream: switch midi-clipboard to ABC

The repo is `C:\Users\alvin\Documents\Projects\midi-clipboard`:
- `MidiClipboard/MidiClipboard.py` is the remote script.
- `MidiClipboard/bridge.py` and `notes_serde.py` are the helper and serializer.
- `grammar.md` describes the current custom `notes:` format.

Xuyan says this change should be quick, and the Ableton copy/paste path is already well tested. Things to watch:
- **Ableton → ABC (copy):**
  - Ableton notes have free start times and lengths, so pick a unit note length (`L:`), quantize, fill gaps with rests, and tie notes across bar lines.
  - Notes that overlap with different durations need separate `V:` voices.
  - Include `X:`, `T:` (clip name), `M:`, `L:`, `Q:` (tempo) and `K:` headers from the clip metadata the script already reads.
- **ABC → Ableton (paste):** parse inside `bridge.exe`, which bundles its own Python, and reuse the existing note-insert path.
- **Lost data:** velocity, `prob`, `vdev` and `mute` are lost or rough (`!p!`/`!f!` dynamics at best). Note this as a deliberate tradeoff.
- **Check that the formats match.** An ABC string copied from the website must paste into Ableton, and a copy from Ableton must render and play on the website.

## 6. Submission note (draft at the end, Xuyan edits it)
- **What it is:** an ABC clip-sharing site with in-browser notation, playback and MIDI export, an AI assistant, and an Ableton bridge.
- **DeepSpace features used:**
  - auth
  - records + RBAC
  - realtime, if used
  - AI chat
  - any others actually used, and why the rest were skipped
- **Main tradeoff:** ABC as the single format. It's simple, readable by LLMs and copyable to and from the clipboard, at the cost of velocity and timing detail and of MIDI-file import.
- **What the agent did vs. what Xuyan verified:** keep a short running log during the build so this is accurate. Don't reconstruct it afterwards.

## 7. Working rules for the session
- Xuyan makes the product and architecture decisions. Ask when a choice would change scope.
- Deploy early and often, and check the important path on the **live** URL, not only locally.
- Don't submit anything in the careers portal. Xuyan submits.
- Keep a `BUILD_LOG.md` in the app folder: decisions, what the agent generated, what was verified and how.
