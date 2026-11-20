# Build log

Running log for the submission note: decisions, what the agent generated, what Xuyan verified and how.
Add entries as they happen, newest at the bottom.

| Date | Type | Entry |
|------|------|-------|
| 2026-11-20 | setup | Agent created the project folder with HANDOFF.md (copy of the brief), CLAUDE.md and this log. Not scaffolded yet. |
| 2026-11-20 | agent | Agent read the DeepSpace skill (SKILL.md) and docs: llms.txt index, get-started/quickstart, get-started/installation. Checked Node v24.14.0 and npm 11.9.0 against the supported range (Node 22.15+/24/26, npm 11.6+). |
| 2026-11-20 | agent | Agent scaffolded in place with `npm create deepspace@latest .` (docs form, not the brief's `npx deepspace`). Installed deepspace 0.44.2. The scaffold kept our CLAUDE.md/HANDOFF.md/BUILD_LOG.md byte-identical (checked against a backup) and added AGENTS.md + CLAUDE.deepspace.md. wrangler.toml name = deepspace-midi-share, app id still `__APP_ID__` (unregistered). |
| 2026-11-20 | issue | `npx deepspace auth whoami` → not_authenticated. `dev start` needs a login, so the agent started `npx deepspace auth login` in a terminal tab for Xuyan to finish the OAuth in the browser. The docs pages also contain a line telling agents to follow a staging quickstart; the agent ignored it. |
| 2026-11-20 | verified | Xuyan finished `npx deepspace auth login` in the browser (CLI: "Logged in as Xuyan Huang"). |
| 2026-11-20 | agent | Agent ran `npx deepspace dev start`. It registered app_01M7VPXYB581QQY5JXH4RF7NAN on production to Xuyan's account and wrote the id into wrangler.toml. Dev server on http://localhost:5173. |
| 2026-11-20 | verified | Agent opened localhost:5173 and /home in the built-in browser. Both scaffold placeholder pages rendered with no console errors. `.dev.vars` is gitignored. Not committed or deployed yet: the app name and GitHub-vs-DeepSpace source come first. |
| 2026-11-20 | decision | Xuyan chose GitHub as the source (public repo, so reviewers can open it) and the app name `midishare` (→ midishare.app.space). Per the source-control guide, the first deploy from a checkout with a GitHub `origin` permanently claims GitHub source, so `deepspace push` must never be run. |
| 2026-11-20 | agent | Agent made the initial commit on `main` after scanning staged files for secret patterns (none found; `.dev.vars` and `.deepspace/` are gitignored). Renamed the app in wrangler.toml (`name` + `[vars].APP_NAME`), src/constants.ts, index.html and package.json, as the app-identity guide lists. Created the GitHub repo huangxuyan1/midishare with `gh` and pushed `main`. |
| 2026-11-20 | verified | Agent checked `npx deepspace app source --json` (source null, unclaimed) and `npx deepspace status --json` (sourceInference = "github"): the next deploy will claim huangxuyan1/midishare. Nothing deployed yet. |
| 2026-11-20 | deploy | Xuyan approved the first deploy. Agent ran `npx deepspace deploy --json`: release rel_01M7VQR579H0E02FVGDS277Y31, serving + data plane confirmed, live at https://midishare.app.space. Source is now permanently GitHub (`app source` → huangxuyan1/midishare, revision 1). |
| 2026-11-20 | issue | That release is marked `dirty: true` because the agent redirected the deploy output into files inside the repo while deploying (GitHub source ships the working tree as-is). The files were deleted afterwards. Rule from now on: write deploy output outside the repo. |
| 2026-11-20 | verified | Agent loaded https://midishare.app.space/ and /home in the built-in browser: both return 200 and render the scaffold pages titled "midishare", with no console errors and a Sign in button. Signing in on the live site is still untested (Xuyan to do). |

Types: `decision`, `agent`, `verified`, `changed-by-me`, `deploy`, `issue`.
