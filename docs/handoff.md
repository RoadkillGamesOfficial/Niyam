# Handoff — current state

## Status
**Phase 1 complete. Phase 2 complete, reviewed and voice-passed (2026-11-08).**
**Phase 3 and Phase 4 are implemented, pending live testing (2026-11-10).**
**v1 hardening is implemented 2026-11-11: snapshot export, bounded automatic
backups, and check-in quick keys, pending browser verification.**
The app now runs a full
day: plan with a profile, start the day, check-ins with XP and combo, habits,
settings, and a day close. Data lives in `data/discipline.db`. Nothing is pushed.
Verified end to end on 2026-11-08 with the dev server on port 3000:
entered a task in the page → row in `task` → one row (not two) after a browser
refresh → marked done → `status = 'done'` and `updated_at` changed on disk →
killed and restarted the dev server → the task and its done state were still
there. `npm test` (70 tests) and `npm run build` both pass.

Commits on this branch, oldest first. `origin` is configured at
`https://github.com/RoadkillGamesOfficial/Niyam.git`; `main` is 13 commits ahead
of `origin/main` after this docs commit. Nothing has been pushed.

| Commit | What |
|--------|------|
| `f04b9a1` | Initial cloud project (base commit) |
| `5dbeb62` | added phased documentation |
| `156ecb8` | phase 1: task and day data access |
| `8aaa68a` | phase 1: task entry and list page |
| `9f6dfe1` | phase 1: document how to run the app |
| `cd0cba6` | phase 1: address review findings |
| `691ee8b` | docs: warm Stardew-inspired visual direction |
| `0e0ea9a` | phase 2: daily plan, check-ins and rewards |
| `e99f1f4` | phase 2: rewards can never decrease |
| `4f6ee35` | phase 2: check-in levels and quiet hours |
| `a5b4265` | phase 2: acceptance, review and voice pass |
| `a910002` | docs: level and copy checks on the committed build |
| `24a923b` | phase 3: local model client, prompts and output validation |
| `5bd0a98` | phase 3: AI proposals, brain dumps and micro-action data |
| `f900046` | phase 3: plan, reframe and AI settings screens |
| `3dbf819` | phase 3: requirement map, handoff and benchmark docs |
| `dbfed79` | phase 4: seed history and local insight queries |
| `1d01b73` | phase 4: insights page, peak scheduling and settings |
| `c1c57ca` | phase 4: requirement map, handoff and voice pass |
| `c397b88` | phase 4: label last week's summary as last week |
| `a64c8c0` | phase 4: give a silent last week an empty state |
| `70191e6` | data: snapshot export, automatic backups and retention |
| `7086a6b` | habits: compare UTC creation times against local due dates |
| `5b6d0b5` | checkin: add O/P/D quick keys for the three responses |

Every hash in this table resolves with `git cat-file -t`. The table now covers
the Phase 3 and Phase 4 work and the 2026-11-11 v1 hardening commits. The docs
commit that adds this text follows the table.

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
- `node:sqlite`, no dependency; Turbopack bundles it (proved when the data
  layer landed).
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
  earlier "add + list only" assumption was corrected in `8aaa68a`.)
- Local timezone defines "today"; there is no setting for it yet.
- Task order is creation order (`created_at`, then `id`), so a done task keeps
  its place instead of jumping to the bottom.

## Reviewer pass (2026-11-08)
Run as `docs/roles/reviewer.md` requires, against the code at `9f6dfe1` plus the
fixes in `cd0cba6`. Exercised on a running dev server with an empty
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

## Visual direction (queued, not built)
The shipped dark monospace styling is the Phase 1 placeholder. The chosen look is
warm and cozy, Stardew Valley-inspired but not pixel art; the specification,
tokens and five-commit rollout live in `docs/design.md`, and the reasoning is in
`docs/decisions.md` (2026-11-08). This is visual-only work: no behaviour, schema
or copy changes, no new dependencies, no image files. Phase 1's own doc is left
unchanged because it records what was actually built.

## Phase 2 (2026-11-08)

Built: manual plan with Daily Profile, reorder and confirm; check-in pulse with
configurable interval, three responses, optional note, pause/resume, missed-slot
reconciliation and quiet hours; interruption levels; XP ledger with combo,
levels, integrity and a heat map; preset task shrinkage on drift; habits with
five frequency kinds, Essential flag, low-energy deferral, streaks, pause and
archive; day close with summary and carry-over suggestions; /settings for
interval, interruption level and quiet hours.

New code: `src/game/` (pure rules: combo/XP/levels/integrity, pulse slots,
habits), `src/db/` additions (`plan`, `pulses`, `xp`, `player`, `habits`,
`settings`, `checkins`), `src/app/check-in.tsx` (client reminder), `/settings`.
Migration `002_phase2.sql` adds plan items, pulses, XP events, pauses, habits,
occurrences and the settings row; Phase 1 rows are untouched.

Verified on a running dev server on 2026-11-08: added a task, started the day,
forced a due slot by moving `confirmed_at` back, answered On Track in the UI
(pulse answered, +10 XP at ×1), created a daily habit (task, occurrence and plan
item created), completed it (+15 XP, occurrence completed), saved settings
(15 minutes, Gentle, quiet 22:00–07:00 persisted), and closed the day (summary
XP 45, 1 answered, 1 missed, 2/3 tasks, 1 carried). `npm test` and `npm run build`
pass on the branch.

### Interruption levels and quiet hours, verified live (2026-11-08)

All three levels were observed firing in the running app, each time by moving
the schedule so a real slot came due while the page was open (the client timer
fired, called `router.refresh()`, and the server created the prompt). A probe
installed in the page counted `AudioContext.createOscillator` calls and
`Notification` constructions; the browser was driven directly.

| Level | Forced due slot | Observed |
|-------|-----------------|----------|
| Gentle | card appeared | card only; 0 oscillators, 0 notifications, no overlay |
| Standard | card appeared | card; exactly one chime (2 oscillators) and one notification; no overlay |
| Firm | overlay opened | full-screen `role="dialog"` overlay; the Settings link was not the topmost element at its own coordinates (the overlay was), so the page is gated; answered On Track through the overlay form |

Answering through the firm overlay wrote the expected rows: `pulse` 5 became
`answered` / `on_track`, and `xp_event` gained `pulse_on_track` +10 with
`pulse_id = 5` (the same shape as answering from the card).

Quiet hours were proved end to end with the level set to Firm and the quiet
window covering the current time: the forced slot produced a `pulse` row with
`quiet = 1` and status `pending`, the page rendered the card with "This one
waited quietly", and there was no overlay, 0 oscillators and 0 notifications,
while the rest of the page stayed reachable. An unanswered quiet prompt is never
aged into a missed check-in.

Two fixes came out of running it rather than reading it:
- Quiet-hour slots used to be filtered out of reconciliation entirely, so a due
  slot inside the window produced nothing at all. The newest quiet slot is now
  recorded as a quiet pending pulse and rendered quietly.
- The timer chimed for a due slot and then the refreshed pending prompt chimed
  again on mount (two notifications for one prompt). Escalation inside 10s of
the timer firing is now suppressed, so one prompt makes one sound.

Limits recorded honestly: the notification permission could not be granted
through a real OS prompt in the headless browser (the request never resolves),
so the page's `Notification.permission` was overridden to `"granted"` and the
constructor was counted — the code path and its one-per-prompt cadence are
proven, but no OS banner was visually seen. The dev server (Turbopack) never
hydrates through this cloud preview proxy because its HMR websocket is refused
(502), so the live proof ran against `npm start` from the same build, with the
server's timezone aligned to the browser's (`TZ=America/New_York`); on a
single-machine install both already match. Closing the tab still loses the
timer until the next open, when reconciliation logs what was missed. See
`docs/decisions.md` for the delivery decision (R1).

## Open questions before Phase 3
- Reviewer pass done (2026-11-08, below). It was run by the building agent in a
  separate pass, so it is a self-review; a genuinely independent read still
  needs the owner or a fresh session.
- Phase 2's `plan_item` (a task placed on the timeline) can be added above these
  tables; Phase 1 stores the day link on the task, so nothing needs rewriting.
  Confirm that reading against PDD §10 before building it.
- Risk R1 is decided (browser-first levels, see `docs/decisions.md`); the
  always-on desktop wrapper is separate, owner-approved work.
- Decide whether to silence the two warnings above (`type: module`, Turbopack
  trace ignore) or leave them documented.
- Nothing has been pushed; pushing is the owner's call.
- Font for the restyle: rounded system stack (recommended, zero assets) or a
  bundled OFL display face committed with its licence?

## Phase 2 acceptance, run end to end (2026-11-08)

Fresh database, production build on port 3000, browser driven directly. Every
criterion was exercised, not just read.

- **A full day, manually.** Added a heavy and a light task, reordered one, set
  Low-energy rescue, added four habits, started the day. The order went from
  Draft→Reply to Reply→Draft and the badge DRAFT→RUNNING. XP then moved on the
  page as it was earned: 0 → 10 after one On Track answer, combo ×1 → ×1.25.
- **Habits on the right days.** The daily essential habit synced a task and a
  pending occurrence; the Sunday weekday habit and the times-per-week habit were
  recorded `deferred` because Low-energy rescue filters non-essential habits, so
  only the essential one appeared in the plan; the Mon/Wed/Fri habit was not due
  on a Sunday and produced no occurrence at all.
- **Interruption level at Firm.** Forcing a real due slot opened the overlay
  (`role=dialog`, `aria-modal=true`); answering On Track inside it wrote
  `pulse.status=answered` and a `pulse_on_track` ledger row of 10, then the
  overlay closed.

### Levels and copy re-checked on the committed build (a5b4265)

The first pass recorded the levels, then the voice-pass copy landed afterwards,
so both were re-run against the committed tree, fresh database, production
build. A page probe counted `AudioContext.createOscillator` calls and
`Notification` constructions, with the permission overridden to "granted".

| Run | What was observed |
|---|---|
| Gentle, interval 5 | timer fired 16:49:07, `pulse` row created `pending`, card rendered, no overlay, **0 oscillators, 0 notifications** |
| Standard, interval 5 | timer fired 16:57:08, `pulse` 5 `pending`, card rendered, no overlay, **2 oscillators (one chime), 1 notification** |
| Firm | pending loud prompt on load opened the overlay, `role=dialog` / `aria-modal=true`, with the answer form inside |

Voice-pass copy observed rendering on the same build: day close reads "Left
unanswered 7" (no "Missed" row anywhere), the combo helper reads "An unanswered
check-in never costs XP. It only resets the combo.", /settings reads "These
numbers live in the code so every change is reviewed. Change them in
src/config.ts and restart.", and the habit detail hint reads "Days as numbers,
Sunday is 0. Try 1,3,5." No wording needed changing; the copy was correct when
it reached the screen.
- **Drift and shrinkage.** Answering Drifted paid 3, reset the combo to ×1, and
  opened the shrink panel; choosing "Open the file and read one line" created a
  real task (5 minutes, light) which paid 15 + 5 when finished.
- **Pause.** Paused, reloaded with an overdue schedule: no card, no overlay, no
  pulse rows created.
- **Missed handling.** Resumed with a 45-minute-old schedule at a 5-minute
  interval: seven slots were backfilled as missed and one stayed pending, and XP
  did not move (33 before, 43 after answering the pending one).
- **Restart.** Killed and restarted the server: ten pulses before, ten after
  (3 answered, 7 missed, 1 pending), same XP, no duplicates.
- **Day close.** Summary: 76 XP, 4 answered, 7 left unanswered, longest on-track
  run 2, 1/4 tasks finished, 3 carried. The ledger sums to exactly 76
  (10+3+15+5+10+13+20), so the 20-point close bonus is counted once.
- **Settings.** Saved 5 minutes, Firm and no quiet hours; "Saved." appeared and
  the values survived the restart.

## Reviewer pass (2026-11-08)

- **Blockers:** none.
- **Should fix:** `src/app/actions.ts` exports two server actions nothing calls
  (`reconcileNow`, `markHabitDoneFromOccurrence`); each is still a reachable
  endpoint, so remove them next time the file is touched. `src/db/xp.ts` declares
  a `task_undone` reason that is never written and an `xpEventsForDay` nothing
  renders — harmless, but misleading to read. `bringOver` dedupes by title only,
  so two different old tasks sharing a title carry over as one.
- **Suggestions:** the check-in panel reuses the unanswered-check-in helper as
  its idle text, which reads slightly oddly while paused. The `[x]` / `[ ]` task
  glyphs are Phase 1 terminal leftovers and leave with the restyle.
- **What works well:** XP is derived from the ledger, and `hasEventForPulse` /
  `hasTaskCompletionEvent` make paying twice structurally impossible (checked by
  re-answering a pulse and by toggling a task off and on). Reconciliation is
  idempotent through the unique `(day_id, due_at)` index, which the restart and
  the 45-minute backfill both confirm. A quiet slot becomes a quiet pending
  pulse that never escalates and never ages into a miss.
- **Verdict:** ready to proceed to Phase 3. Caveat: this pass was done by the
  same agent that built Phase 2, so it is not an independent review.

## Voice pass (2026-11-08)

Voice written down for the first time in `docs/voice-guide.md`: the voice in one
page, preferred and avoided words, and example lines for check-ins, drift, empty
states, quiet hours and errors. Copy edits: "Left unanswered" replaces "Missed"
on the day close, the helper line says "An unanswered check-in never costs XP",
the /settings game note is plain English instead of developer-speak, and the
weekday hint reads "Days as numbers, Sunday is 0. Try 1,3,5." Wording decisions
are recorded in `docs/decisions.md`. One open item needs the owner: the product
name and tagline.

## Design revamp (2026-11-08)

The warm, Stardew-inspired look from `docs/design.md` is now the shipped UI,
replacing the Phase 1 terminal styling. Visual only: no behaviour, schema or
copy changes, no dependencies, no images, no runtime font fetch.

What changed in `src/app/globals.css`: a parchment palette with a daylight
vignette and one grain layer; a rounded type scale (14/17/20/26/34px) with
tabular numerals; panels as wooden cards; the wordmark hanging on a sign and the
day line on a ribbon; tasks as slips with a 22px seed toggle that fills leaf and
draws a check; leaf pill buttons with a darker bottom edge and a press offset;
recessed parchment inputs; the check-in as a pinned notice board; a warm scrim
overlay; a leaf heat map; and a `prefers-reduced-motion` block that removes all
motion.

Three draft hexes were darkened so they meet their own targets: leaf
`#5b8c3e` → `#47712f` (5.39:1 for button text), gold `#e3b04b` → `#a8781f`
(3.36:1 for the focus ring), sky `#5d87a6` → `#46688a` (5.49:1). The measured
pair table is in `docs/design.md` under "Shipped values".

A second, desktop-focused pass followed the owner's note that the page read
plain on a laptop: from 980px the shell widens to 1120px, stats go three-up,
plan and habits sit in two columns, the heat map becomes a calendar strip, and
panel headings get a gold marker and hairline. The grid is scoped to the
dashboard with `:has(.stats)`, which also fixed the settings page where the
strip layout had squeezed the game values into a side column.

Every view followed: a closed day's summary spans the full dashboard width, and
settings has a two-column desktop layout (form beside the game-values list).
Panel padding is back to 16px/24px on small screens and 24px only from the
desktop breakpoint, so the 320px layout is single-column with no horizontal
overflow.

On a running day the check-in board spans two grid rows so the plan rises under
"On now"; at 1280px the left column ends at 901px and the check-in column at
908px. The habits panel spans the full width and pairs its form fields two-up,
so no part of the dashboard sits beside an empty column.

Commits: `905bc4d` (palette, frame, sign) and the slips/motion commit that
follows it, both `design revamp:` prefixed. `npm test` and `npm run build` pass.

Verified in one preview tab: no horizontal overflow at 320, 768 and 1280px, nor
at 640px (a 1280px window at 200% zoom). The check-in board and the firm overlay
render inside the viewport down to 320x480. Captures are in
`docs/design-revamp-320.png`, `docs/design-revamp-1280.png` and
`docs/design-revamp-overlay.png`. One defect surfaced and was fixed: the plan
form's Add button overflowed its card.

## Phase 3 — local AI (2026-11-09)

Implemented, not yet run: no model was started and no browser checks were made
this session, by request. `npm test` (104 tests) and `npm run build` pass.

What is in place: a loopback-only Ollama client (`src/ai/ollama.ts`, built-in
fetch, 60s timeout, one JSON retry); validated planner output reviewed before it
saves (`plan_proposal`); `/reframe` with stored, editable and deletable brain
dumps, another-angle regeneration, an accepted micro-action task, and a fixed
supportive safety response when distress phrases appear; AI shrinkage with the
Phase 2 presets as fallback; prompt files in `prompts/`; an AI switch, model
field and connection check in Settings; migration `003_phase3.sql` adds the
brain dump, proposal, item tables and AI settings columns.

Default model `qwen2.5:1.5b-instruct` (candidates in `src/config.ts`). The
benchmark is `node scripts/benchmark-ai.mjs` over `docs/ai-test-set.json`; it has
not been run, so the model choice is still unmeasured.

To test on a running app: `ollama pull qwen2.5:1.5b-instruct`, `ollama serve`,
`npm run dev`. Shape a draft list and accept the review, open `/reframe` (or
press R), try another angle, accept the step, delete a dump, run Drifted → Ask
for a smaller step, then stop Ollama and repeat: every screen must still work in
fallback mode and say so.

### Audit fixes (2026-11-09)

A requirement-by-requirement audit against `docs/phase-3-local-ai.md`, PDD
§8.1/8.3/11/12 and R7 found three gaps, now fixed:

- **PLAN-4 had no AI re-plan.** "Re-plan the rest" now asks the model for a full
  permutation of the open tasks (`src/ai/replan.ts`, `prompts/replan.md`),
  applies it with `reorderOpenItems`, and keeps the current order on failure or
  when AI is off. The model never renames, deletes or invents a task.
- **Reframe had no optional shrunken task.** The dump form can be tied to an
  open task; accepting the step then creates it as a child of that task
  (`brain_dump.source_task_id`, migration `004_phase3_reframe_task.sql`).
- **A reframe step paid no micro-action XP.** `toggleTask` now pays
  `micro_action` when a task has a parent or a brain dump, guarded by
  `hasMicroActionEvent` so reopen/re-complete cannot pay twice.

Smaller changes: the Drifted panel now leads with the AI step and keeps the
Phase 2 presets in a "Preset steps" fallback (open by default when AI is off);
AI buttons show "Working..." via `useFormStatus`, so a slow local model does not
look frozen. The reframe history now lists every dump instead of the newest ten,
so REF-4's "viewable" holds for old entries too. At that point the suite was 104
tests; `npm run build` passed. The requirement map is in
`docs/phase-3-local-ai.md`.

## Phase 4 — telemetry and calibration (2026-11-10)

Implemented, not yet run in a browser or against a live model: `npm test` (114
tests) and `npm run build` pass on the working tree. The seed CLI was exercised
against a throwaway database and then removed.

What exists: `/insights` with a 7 × 24 drift heat map, completion by Daily
Profile, eight weekly trend rows (consistency, longest on-track run, integrity),
per-habit completion and streaks with shrink/reschedule next steps, peak-window
detection, and Today / This week / Last week observations. Settings has an
Insights panel with the INS-3 switch. When peak planning is on, starting the day
or editing the plan writes suggested `plan_item.planned_start` times, moving a
heavy task to the next detected peak without changing the order; turning the
switch off clears those times. The AI planner prompt also receives the peak
windows.

Data stays local: new queries in `src/db/insights.ts` read the existing day,
task, pulse, habit and XP rows; no new event tables and no network calls. The
demo generator is `src/db/seed.ts` with `scripts/seed-insights.mjs`: run
`npm run seed -- --db data/seed.db --fresh`, then
`NIYAM_DB=data/seed.db npm run dev`. The separate file and the `NIYAM_DB`
override keep real data out of seeding. Migration `005_phase4_insights.sql` adds
the switch.

The phase's requirement map is in `docs/phase-4-telemetry.md`. Still open: live
acceptance and visual review, an independent reviewer pass, and the unrun model
benchmark from Phase 3.

## v1 hardening — export, backups and quick keys (2026-11-11)

Implemented and covered by unit/integration tests. No browser and no live model
was run, by request.

### Export

Settings → Your data → **Download a snapshot**, or run
`npm run export -- --out data/exports/niyam-export.db`. The default output is a
timestamped file in `data/exports`; `--db` selects another database. The
`/export` route and the script both use `VACUUM INTO`, so the result is one
standalone `.db` image, not a copy of a live file plus its WAL.

To restore: stop the app, keep a copy of the current database, replace
`data/discipline.db` with the snapshot, remove `data/discipline.db-wal` and
`data/discipline.db-shm`, then start the app. The test in
`src/db/backup.test.ts` exports, mutates the source, opens the snapshot, and
asserts the original title and day are back.

### Automatic backups

`getDatabase()` calls `ensureAutomaticBackup` on database open. The newest backup
must be at least 24 hours old before another is written, and only the newest 7
are kept (both tunables in `CONFIG.backup`). The live database writes to
`data/backups`; a seed or other `NIYAM_DB` database writes beside itself, such as
`data/seed-backups`, so demo data cannot prune real backups. Pruning is by file
modification time. The Settings **Back up now** button uses the same snapshot and
retention path. A failed backup is logged and does not block the app. Tests cover
creation, the interval skip, pruning, manual backups, and the separate-folder
rule.

Exports are deliberate user files in `data/exports` and are not pruned
automatically.

### Quick keys

On the inline check-in card, **O** answers On track, **P** answers Pivot, and
**D** answers Drifted. **R** remains the Reframe shortcut. The keys ignore
modifier chords, key repeats, text fields, selects, content-editable areas, and
any visible `aria-modal` dialog; the firm overlay therefore keeps focus. They
submit through the same server action as the buttons. A quick key records no
note; use the buttons when adding one. Tests cover all three mappings, typing
suppression, modal suppression, unrelated keys, and storage of each response.

### Verification and open items

`npm test` is 126/126 green and `npm run build` passes after the hardening. The
export CLI was exercised against a throwaway database, and the restored file
contained the expected task. Still open: a browser check of the download, the
Settings backup button and the shortcut suppression, plus the deferred Phase 3
and Phase 4 live acceptance and model benchmark.

## Rules being followed
docs/roles/builder.md: current phase only; no runtime network calls or cloud;
tunables in config; all user-facing strings in `src/copy.ts`; update
`docs/handoff.md` and `docs/decisions.md` before ending a session.
