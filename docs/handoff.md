# Handoff — Phase 1: Local Foundation

## Status
**Phase 1 complete.** One page adds a task for today, lists today's tasks and
marks one done. Data lives in `data/discipline.db`. Nothing is pushed.

Verified end to end on 2026-11-08 with the dev server on port 3000:
entered a task in the page → row in `task` → one row (not two) after a browser
refresh → marked done → `status = 'done'` and `updated_at` changed on disk →
killed and restarted the dev server → the task and its done state were still
there. `npm test` (12 tests) and `npm run build` both pass.

Commits (each builds and passes tests, except 0–1 which predate the test script):

| # | Commit | What |
|---|--------|------|
| 0 | `226eb68` | docs baseline |
| 1 | `9c9afce` | scaffold Next.js app |
| 2 | `a0ff36d` | SQLite connection + migration runner |
| 3 | `156ecb8` | task and day data access + tests |
| 4 | `8aaa68a` | add/list/done page |
| 5 | `9f6dfe1` | README, handoff, decisions |
| 6 | (this commit) | reviewer pass fixes and record |

Commits 0–2 are the unsigned rewrites; the remote copies (`76ae5e8`,
`a912e13`) are content-identical. `git push` fast-forwards when asked.

## How to run
```
npm install
npm run dev      # open the URL it prints; the port is not always 3000
npm test         # data-layer tests against throwaway databases
npm run build    # production build + type check
```

## What exists
- `src/app/page.tsx` — server component: reads today's day, lists its tasks,
  renders the add form and one toggle form per task.
- `src/app/actions.ts` — two server actions, `addTask` and `toggleTask`, each
  writing SQLite then `redirect("/")`. The page is `force-dynamic` because it
  reads the database per request.
- `src/db/` — `database.ts` (connection + pragmas + migrate), `migrations.ts`
  (filename-ordered, recorded in `schema_migrations`), `days.ts`, `tasks.ts`,
  `index.ts` (one connection per process, cached on `globalThis` so dev reloads
  do not leak handles).
- `src/time.ts` — `localDateString()`, the only place a clock is read. "Today"
  is the laptop's local date.
- `src/copy.ts` — every user-facing string, including the one `PRODUCT_NAME`.
- `src/config.ts` — database location and `tasks.maxTitleLength` (200).
- `migrations/001_init.sql` — `day`, `task`, the `task_by_day_and_status` index.
- Tests: `src/db/days.test.ts`, `src/db/tasks.test.ts`, sharing
  `src/db/test-helpers.ts` (`withTempDatabase`, which never touches `data/`).

## Decisions worth knowing (details in docs/decisions.md)
- `node:sqlite`, no dependency; Turbopack bundles it (proved at commit 2).
- `node:test` + `node:assert/strict`; erasable TS only, `.ts` import specifiers,
  relative imports in the data layer, a quoted glob on the test command.
- Plain CSS with custom-property tokens; `sass` is a near-free upgrade later.
- Mutations are form posts and redirect: the first version only revalidated, and
  a refresh re-sent the POST, inserting the same task twice during the
  acceptance run. Post/redirect/get fixed it.

## Details that still matter
- The first `next build` rewrote `tsconfig.json`: `jsx: react-jsx` and
  `.next/dev/types/**/*.ts` added to `include`. `allowImportingTsExtensions`
  survived, which the tests depend on.
- Migrations are read from `process.cwd()`, so dev, start and tests must run
  from the project root. The npm scripts do.
- `node --test` prints `MODULE_TYPELESS_PACKAGE_JSON` for each test file because
  `package.json` has no `"type": "module"`. Harmless; adding `type: module` would
  silence it and is a Phase 2 candidate.
- Next telemetry is forced off by `scripts/next.mjs`, which every npm script
  runs: it sets `NEXT_TELEMETRY_DISABLED=1` and then loads the Next CLI. The
  wrapper exists because an inline `VAR=1` prefix does not work in Windows
  `cmd`. `node scripts/next.mjs telemetry status` reports "No data will be
  collected from your machine".
- `next build` prints one Turbopack warning about `process.cwd()` in
  `databasePath()` tracing the project. Benign for a local app; relevant only if
  this is ever deployed.
- ESLint was left out deliberately (dependency rule); add on request.

## Schema
- `day`: id, date (unique, YYYY-MM-DD), profile, started_at, closed_at, summary
- `task`: id, day_id → day, title, notes, estimated_minutes, cognitive_load
  (light|medium|heavy), status (open|done), parent_task_id → task, created_at,
  updated_at
- `schema_migrations`: applied filenames
- DB file `data/discipline.db`: WAL, `foreign_keys = ON`, `busy_timeout = 5000`,
  gitignored.

## Assumptions
- "Session markers" = PDD's Day entity; one row per local calendar day, created
  lazily on first visit.
- Phase 1 UI is add, list and mark done. No edit, no delete, no reordering.
  (`docs/phase-1-foundation.md` puts done in scope and in acceptance, so the
  earlier "add + list only" assumption was corrected at commit 4.)
- Local timezone defines "today"; there is no setting for it yet.
- Task order is creation order (`created_at`, then `id`), so a done task keeps
  its place instead of jumping to the bottom.

## Reviewer pass (2026-11-08)
Run as `docs/roles/reviewer.md` requires, against the code at `9f6dfe1` plus the
fixes in this commit. Exercised on a running dev server with an empty
database: empty state, adding a task, refresh, marking done, reopening, browser
restart with the server killed and started again, and bad input (blank title,
spaces only, a 250-character title forced past the `maxLength` attribute, an
HTML/script payload, and a SQL `'; DROP TABLE task;--` payload). Tests and build
were rerun at HEAD.

- **Blockers:** none.
- **Should fix (fixed here):**
  1. Telemetry was still on for `dev` and `build` (anonymous ID was written to
     `~/.config/nextjs-nodejs/config.json`), which contradicts "no telemetry"
     in `docs/knowledge.md`. Fixed with `scripts/next.mjs`, which forces
     `NEXT_TELEMETRY_DISABLED=1` without adding a dependency and without
     breaking Windows shells.
  2. The task checkbox glyphs and the day separator were literals inside
     `src/app/page.tsx`, against "all UI strings in one central copy file".
     Moved to `COPY.home.taskDoneMark`, `taskOpenMark` and `daySeparator`.
- **Suggestions (not done):**
  - `localDateString` now has tests; if "today" ever becomes configurable, those
    are the tests to extend.
  - Server actions rely on Next's built-in origin check rather than an explicit
    CSRF token. Acceptable for a single-user local app; revisit if the app ever
    binds to a network interface.
  - The Turbopack trace warning about `process.cwd()` stays documented rather
    than silenced, because it only matters for deployment.
- **What works well:** post/redirect/get makes refresh idempotent; the data layer
  is plain functions over a connection, so every test runs against a temp file
  and never touches `data/`; hostile titles are stored literally and rendered as
  text (React escapes them, SQLite is only reached through prepared statements);
  the `task` table survived the SQL payload attempt and still had one row.

Verdict: **ready to proceed to Phase 2.** Phase 1 is in scope, its acceptance
criteria pass on a running app, and nothing outside the phase was built.

## Open questions before Phase 2
- Run the reviewer role (`docs/roles/reviewer.md`) as the phase doc requires.
- Phase 2's `plan_item` (a task placed on the timeline) can be added above these
  tables; Phase 1 stores the day link on the task, so nothing needs rewriting.
  Confirm that reading against PDD §10 before building it.
- Phase 2 needs a decision on the check-in delivery prototype (Risk R1).
- Decide whether to silence the two warnings above (`type: module`, Turbopack
  trace ignore) or leave them documented.
- Nothing has been pushed; pushing is the owner's call.

## Rules being followed
docs/roles/builder.md: current phase only; no runtime network calls or cloud;
tunables in config; all user-facing strings in `src/copy.ts`; update
`docs/handoff.md` and `docs/decisions.md` before ending a session.
