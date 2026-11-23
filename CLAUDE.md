# deepspace-midi-share

DeepSpace SWE Intern (Summer 2027) build exercise: an ABC-notation clip-sharing app on DeepSpace.
**The full brief, decisions and schedule are in [HANDOFF.md](docs/HANDOFF.md). Read it first.**
**Current state and the to-do list are in [SESSION_HANDOFF.md](docs/SESSION_HANDOFF.md) (updated in session 3, 2026-11-23).**

- Hard deadline: **Tue Nov 24, 2026, 11:59 PM ET** (confirmed from the DeepSpace invite email on 2026-11-23).
- Read the DeepSpace agent skill (https://github.com/deepdotspace/deepspace-skill) and the quickstart (https://docs.deep.space) before writing code. Check CLI commands against the docs, not the brief.
- App name: `midishare` → https://midishare.app.space (decided 2026-11-20). The folder keeps its old name. Display name is `APP_NAME` in `src/constants.ts` and `[vars]` in `wrangler.toml`.
- Source: GitHub, public repo `huangxuyan1/midishare`. The first deploy with that `origin` remote claims GitHub source permanently. Never run `deepspace push`.
- Scaffolded on 2026-11-20 with `npm create deepspace@latest .` (deepspace 0.44.2, SDK pinned exactly). The scaffold's own agent notes are in [AGENTS.md](AGENTS.md) (via `CLAUDE.deepspace.md`); read them too.
- The app registers on first use (`dev start`, `deploy`, `app init`, secrets write) under whatever account `npx deepspace auth whoami` shows. Register before the first commit.

## Working rules
- Xuyan makes the product and architecture decisions. Ask when a choice would change scope.
- Xuyan signs in and creates accounts. Don't enter credentials or create accounts.
- No API keys in client code or in the repo. Use DeepSpace secrets / server-side AI helpers.
- Enforce ownership with DeepSpace permissions, not only by hiding UI.
- Prefer platform primitives over reimplementing them.
- Keep code plain and readable: Xuyan must explain and modify all of it in a live coding round.
- Deploy early and often, and verify the important path on the live URL.
- Don't submit anything in the careers portal.
- Update [BUILD_LOG.md](docs/BUILD_LOG.md) as you go: decisions, what the agent generated, what was verified and how. Don't reconstruct it afterwards.

## Related
- Using Modular (`C:\Users\alvin\Documents\Projects\Modular`) as the audio engine is planned, set aside as a separate task: [docs/MODULAR_AUDIO_ENGINE.md](docs/MODULAR_AUDIO_ENGINE.md).
- The Ableton bridge lives at `C:\Users\alvin\Documents\Projects\midi-clipboard` (outside this folder). Switching it to ABC is a separate workstream (docs/HANDOFF.md section 5).
