# Handoff — Phase 1: Local Foundation

## Status
Phase 1 under way. Commit 0 (docs baseline) and commit 1 (scaffold) are the
first two steps; the rest of the commit plan below is unchanged. App runs with
`npm run dev`.

Open technical risk: Next/Turbopack resolving `node:sqlite` is not yet proven.
Spike it at commit 2; fall back to better-sqlite3 (ask first) only if it fails.

## Settled approvals (2026-11-05, details in docs/decisions.md)
- SQLite driver: `node:sqlite`. Verified here (Node v24.21.0): DatabaseSync,
  WAL, foreign_keys, prepared statements, SQLite 3.53.4, no experimental
  warning. Server-side only. Fallback: better-sqlite3 13.0.3 (needs approval).
- Tests: `node:test` + `node:assert/strict`, runs `.ts` directly. Constraints:
  erasable TS only (no enum/parameter properties), `allowImportingTsExtensions`
  in tsconfig, glob not directory on the command line, relative imports in the
  data layer (no `@/` alias). Fallback: Vitest (ask first).
- Styling: hand-written CSS with custom-property tokens. `sass` later if it is
  needed (near-free upgrade); Tailwind not planned.
- Product name: Niyam, confirmed. One constant (`PRODUCT_NAME`) in
  `src/copy.ts`; never in the DB filename, package name, or schema.

## Scope
In: scaffold, SQLite init + migrations, task/day repositories with tests,
one page to add + list tasks, src/copy.ts, src/config.ts, README.
Out: check-in timer, XP, combos, levels, integrity meter, habits, AI, insights,
screen time. Deferred schema (Phase 2): plan_item, prerequisites, pulse, habits.

## Schema (minimal, additive later)
- day: id, date, profile (nullable), started_at, closed_at, summary
- task: id, day_id, title, notes, estimated_minutes, cognitive_load
  (light|medium|heavy), status (open|done), parent_task_id, created_at, updated_at
- schema_migrations: applied migration filenames
DB file: data/discipline.db (relative path, WAL, foreign_keys on). Gitignored.

## Assumptions
- "Session markers" = PDD's Day entity; one row per local calendar day.
- Phase 1 UI is add + list only (no complete toggle, no edit/delete).
- Local timezone defines "today".

## Commit plan (each commit must work: npm test && npm run build pass, dev server starts)
0. `phase1: add project docs baseline` — docs/ only. Add .gitignore in commit 1
   (node_modules, .next, data/, *.db, *.db-wal, *.db-shm).
1. `phase1: scaffold Next.js app` — placeholder page serves.
2. `phase1: add SQLite connection and migration runner` — creates DB, applies 001_init.sql.
3. `phase1: add task and day data access` — createTask/listTasksForDay/getOrCreateDayForDate + tests.
4. `phase1: add task entry and list page` — add → refresh → still there.
5. `phase1: document how to run the app` — README, handoff, decisions.
Message style: `phase1: <imperative>`, one concern per commit, no wip fixups.

## Done when
Task entered in UI → row in data/discipline.db → correct after page refresh →
correct after restarting the app → tests and build pass.

## Rules being followed
docs/roles/builder.md: current phase only; no runtime network calls or cloud;
tunables in config; all user-facing strings in src/copy.ts; update
docs/handoff.md and docs/decisions.md before ending a session.