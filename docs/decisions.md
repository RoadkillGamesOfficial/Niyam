# Decisions

Running log of settled decisions. Newest last. Each entry records what we
decided, why, and what it rules out.

## 2026-11-05 — Phase 1 approvals settled

Context: Phase 1 (Local Foundation) plan approved in `docs/handoff.md`. These
four decisions unblock building.

### Product name: Niyam

Decision: display name is **Niyam** for now. It appears in exactly one place,
`PRODUCT_NAME` in `src/copy.ts`. It is not in the package name, the database
filename (`data/discipline.db`), table or column names, CSS class names, or
storage keys.

Why: a rename then costs one line plus a docs edit. The folder is already
`C:\Code\Niyam`, so the name and the path agree.

### SQLite driver: `node:sqlite`

Decision: use the built-in `node:sqlite` module. No dependency.

Verified on this machine (Node v24.21.0): `DatabaseSync` works, bundled SQLite
is 3.53.4, `PRAGMA journal_mode = WAL` and `foreign_keys = ON` apply, prepared
statements return `{ changes, lastInsertRowid }`, and no experimental warning is
printed.

Why: it has the same synchronous shape as better-sqlite3, so the code transfers
if we ever switch, and it carries no native-build risk on Windows.

Rules that follow:
- Database code is server-side only. Never import it from a `"use client"`
  module, and never run it in the edge runtime.
- Keep the connection behind a single module (`src/db/`) so swapping to
  better-sqlite3 is a one-file change.
- Fallback if Next's bundler cannot resolve `node:sqlite`: better-sqlite3
  13.0.3. That is a new dependency and needs approval first.

### Tests: `node:test` + `node:assert/strict`

Decision: built-in test runner and assertions. No dependency.

Verified on this machine: `node --test` runs `.ts` files directly (type
stripping), with or without a package.json, so tests import the real data-layer
modules with no build step.

Constraints that follow from strip-only mode:
- Erasable TypeScript only: `enum`, constructor parameter properties, and
  namespaces throw `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`. Use string unions and
  plain interfaces.
- `allowImportingTsExtensions: true` in `tsconfig.json` so Next's type check
  accepts `.ts` import specifiers.
- Pass a glob or explicit files to `node --test`, not a bare directory (a
  directory argument failed here with `MODULE_NOT_FOUND`).
- Data-layer and config modules use relative imports. The `@/` alias does not
  resolve under plain Node.

Vitest (5.1.0) stays the fallback if the suite outgrows this, most likely in
Phase 3 when AI output validation arrives.

### Styling: plain CSS now, SCSS later if needed

Decision: hand-written CSS with design tokens as CSS custom properties in
`src/app/globals.css`. No Tailwind, no preprocessor.

Why: zero dependencies for a one-page UI, and the tokens have to be CSS custom
properties anyway because Phase 2's combo multiplier and integrity meter are
driven by runtime state, which compile-time Sass variables cannot express.

Upgrade path: if the stylesheet outgrows one file, install `sass` (a dev
dependency, pure JS) and rename to `.scss`. SCSS is a superset of CSS, so that
is a near-free change. Tailwind is not planned; revisit only if the UI grows
past roughly ten screens with a shared design system.

### Scaffold: Next.js 16.4.5, no ESLint

Decision: Next.js 16.4.5 with the App Router and TypeScript, dependencies
installed directly rather than through `create-next-app` (which refuses to
scaffold into a directory that already contains `docs/`).

ESLint is deliberately left out for now: it is a dev dependency and the
dependency rule says ask first. Add it on request.

## 2026-11-08 — Phase 1 page and data access

### Data access: plain functions that take a connection

Decision: `src/db/days.ts` and `src/db/tasks.ts` export functions whose first
argument is the `DatabaseSync` connection (`getOrCreateDayForDate`,
`createTask`, `listTasksForDay`, `setTaskStatus`, `getTask`). The single
connection lives in `src/db/index.ts`, cached on `globalThis` so Next's dev
reloads reuse it instead of leaking a handle per edit.

Why: no repository class, no dependency-injection framework, and tests can aim
the same functions at a temp database. Keeping the connection in one module also
keeps the driver swap a one-file change, as promised under `node:sqlite`.

Rules that follow:
- A test never opens `data/discipline.db`; `src/db/test-helpers.ts` provides
  `withTempDatabase`, which migrates a temp file, closes it, then deletes it
  (closing first matters on Windows).
- New queries go in these modules, not inline in a page or action.

### Mutations: server actions that redirect (post/redirect/get)

Decision: two server actions in `src/app/actions.ts`, `addTask` and
`toggleTask`. Each writes SQLite and then calls `redirect("/")`. The page is
`export const dynamic = "force-dynamic"`, and the forms are plain form posts, so
the page still works without client JavaScript.

Why: the first version called `revalidatePath("/")` instead. That left the
browser sitting on the POST result, so refreshing the page re-sent the form and
inserted the same task a second time — observed live during the acceptance run
(two rows, identical title, three `POST /` lines in the dev log). The redirect
leaves the browser on a GET of the list, which makes refresh harmless.

Rules that follow:
- A mutation that changes what the page shows must redirect, not just
  revalidate.
- Actions validate the same limits the form enforces (title non-empty, at most
  `CONFIG.tasks.maxTitleLength`) because a POST can arrive without the page.

### Marking a task done is in Phase 1

Decision: task completion is in scope, with `setTaskStatus` in the data layer
and one toggle per task in the UI. `docs/handoff.md` had said "add + list only"
and was corrected to match `docs/phase-1-foundation.md`, which lists marking a
task done in scope and in acceptance.

Why: an acceptance criterion without a way to satisfy it is not a scope
question. The status column, `open|done` check and index already existed, so this
added no schema work.

What it rules out: nothing already planned. Edit, delete and reordering stay out
of Phase 1, and history is still never deleted — a task is flagged, not removed,
so it can be reopened without losing when it was created.

### A day is keyed by the local calendar date

Decision: `day.date` is `YYYY-MM-DD` from `localDateString()` in `src/time.ts`,
the one place a clock is read. `getOrCreateDayForDate` creates the row lazily on
first visit and is idempotent (`ON CONFLICT` then read back).

Why: Phase 1 has no accounts, no server and no timezone setting, so the laptop's
local date is the only defensible definition of "today". Creating the row on
first visit means there is no startup step or background job.

What it rules out: a task cannot be entered for a day other than today yet, and
changing the machine's timezone changes which day new tasks land in.

## 2026-11-08 — Reviewer pass: telemetry off, copy centralized

### Telemetry is disabled for local builds, not just opted out of in docs

Decision: every npm script runs Next through `scripts/next.mjs`, a six-line
wrapper that sets `NEXT_TELEMETRY_DISABLED=1` and then loads the Next CLI.

Why: the reviewer pass found Next had written an anonymous ID and salt to
`~/.config/nextjs-nodejs/config.json` and would send usage events on `dev` and
`build`. `docs/knowledge.md` says no telemetry and no outbound calls, and the
earlier answer (document the opt-out in the README) left the default on.
`node scripts/next.mjs telemetry status` now prints "No data will be collected
from your machine"; the unwrapped CLI still prints that it is enabled.

Why a wrapper rather than an env prefix: `NEXT_TELEMETRY_DISABLED=1 next build`
does not work in Windows `cmd`, and `cross-env` would be a new dependency. The
wrapper is plain Node with no packages.

Rules that follow:
- Run the app through `npm run dev` / `npm run build` / `npm start`, not by
  calling `next` directly, or telemetry comes back for that run.
- A new dependency is still required before adding anything else of this kind.

### Every visible string, including glyphs, lives in `src/copy.ts`

Decision: the checkbox marks (`[ ]`, `[x]`) and the day separator (`·`) moved
from `src/app/page.tsx` into `COPY.home`, alongside the labels they belong to.

Why: the phase doc says all UI strings live in one central copy file, and the
reviewer found three literals that had been left as inline JSX. They are exactly
the kind of thing the voice writer may want to change later.

What it rules out: no UI text, punctuation glyphs included, is written directly
in a component.

## 2026-11-08 — Visual direction: warm, Stardew-inspired, not pixel art

Decision: the interface moves to a cozy farm-sim look — parchment surfaces,
wooden frames, rounded chunky controls, warm daylight palette, gentle motion,
gold for rewards — and away from the dark monospace terminal styling Phase 1
shipped. The full specification is `docs/design.md`.

Why: `docs/PDD.md` §13 already specifies "Stardew Valley-inspired, game-console
in feel", gamification is a core principle rather than an add-on, and
`docs/phase-1-foundation.md` called the terminal styling a placeholder whose
"full design comes later". `docs/knowledge.md` had drifted to saying the style
was terminal-inspired; that line now matches this decision.

Why not pixel art: the owner wants the game's warm, casual, calming feeling
without 16-bit graphics. So the game feel comes from material, depth, shape and
motion (borders, shadows, easing, press feedback) rather than sprites, and no
pixel fonts or `image-rendering: pixelated` are used.

Constraints this sets:
- Visual only. It changes no behaviour, schema or copy; every string stays in
  `src/copy.ts`, and new labels go through the voice writer.
- No new dependencies and no image files: the look is CSS, with inline SVG only
  where a CSS shape cannot do the job. That keeps the no-outbound-calls rule and
  the ask-before-adding rule intact.
- Colours, radii, durations and type sizes live as CSS custom properties in
  `src/app/globals.css`; components never hardcode them.
- Contrast is measured, not eyeballed, and state is never conveyed by colour
  alone (done tasks also strike through and show a drawn check).
- A bundled OFL display font is the one outstanding asset question; it needs
  approval and would be committed locally, never fetched at runtime.

What it rules out: the terminal aesthetic (`> ` prefixes, `[x]`/`[ ]` glyphs,
monospace body text, near-black background) as anything other than history, and
any "gamified" visual flourish that ships before Phase 2's mechanics do.

## 2026-11-08 — Phase 2: game loop decisions

### Check-in delivery: browser-first, recorded for Risk R1

Decision: check-ins reach the user three ways, chosen by interruption level —
Gentle shows only the in-page card, Standard adds a locally generated chime and
a browser notification, Firm adds a full-screen overlay. Notifications are
requested on the first click and only fire while the app is open in a tab.

Why: the prototype options in `docs/phase-2-game-loop.md` were browser
notifications with sound, an installable web app, and a desktop wrapper. The
first needs no dependency and no manifest. An installable app would still need a
service worker and push (a server or OS integration), and a wrapper means a
new dependency plus an installer, both against the local-first, ask-first
rules. So delivery stays in the browser, and the honest limit is recorded.

What this satisfies and what it does not: while the tab is open and the user is
in another app, the chime and OS notification still fire (PULSE-1 for that
case). After the browser is closed or the laptop sleeps, slots are reconciled on
next open: anything older than the grace window is logged as missed, so nothing
is lost or counted twice (PULSE-4). A true always-on reminder needs a desktop
wrapper and is a separate, owner-approved piece of work.

### Player state is derived, never stored

Decision: `xp_event` is append-only and there is no player table. Total XP,
level, combo and integrity are recomputed from the ledger and pulse history on
render (`src/db/player.ts`). The combo is a fold over answered check-ins, with a
missed pulse counting as a drift for the multiplier only.

Why: GAME-1 and GAME-2 become structural rather than promises — a bug would have
to delete ledger rows to lose XP, and retuning the rules re-scores history the
way the PDD intends. The cost is a handful of small queries per render, which is
nothing for one local user.

### Pauses are windows, not counters

Decision: `pause` rows record `started_at`/`ended_at`; the scheduler subtracts
those windows when it computes due slots, and quiet-hour slots are not created at
all. Paused and quiet time can never produce a missed check-in.

Why: a counter makes "paused for 20 minutes, resumed, paused again" ambiguous,
and a missed pulse already resets the combo — punishing a deliberate break twice
would break the never-shame principle.

### Habits: archive, defer, and generate tasks

Decision: habits create real tasks tagged with `habit_id`, plus one occurrence
row per due day. Deleting a habit archives it (`archived_at`) so occurrences and
streaks stay readable. Low-energy days write `deferred` occurrences for
non-essential habits instead of tasks; deferred is never a failure. Streaks count
completed due-days newest-first with one forgiven miss per week. Creating a habit
mid-day syncs it into today's plan if the day is still open.

Why: HAB-3 and HAB-4 want habits to be automatic and to stay visible inside a
window, while HAB-5 and HAB-7 forbid penalties and history loss. Archive plus
occurrences gives both without a second history store.

### Phase 2 scope choices

- Task editing, merging and deletion stay out: the phase doc's in-scope list is
  enter, profile, reorder, confirm, timeline. Shrinking creates a child task and
  keeps the parent, so nothing is destroyed.
- Re-planning only moves open items above finished ones; it does not regenerate
  timings, which would need the Phase 3 planner.
- Carry-over is a suggestion: yesterday's open tasks appear with a "bring over"
  button and nothing moves until asked (PLAN-6).
- Gamification numbers stay in `src/config.ts` and are displayed read-only on
  /settings, so they are reviewed like code (GAME-4).

## 2026-11-08 — Phase 2: interruption levels proven, quiet slots kept

### A quiet-hour slot is a quiet prompt, not nothing

Decision: reconciliation keeps the newest quiet-hour slot as a `pulse` row with
`quiet = 1` and status `pending` (migration `003_quiet_pulses.sql` adds the
column). The page renders it as the normal card with a quiet note, and it is
exempt from the aging pass that turns unanswered loud prompts into missed ones.

Why: the earlier code filtered quiet slots out of `reconcile` entirely, with the
intent that quiet time never produces a missed check-in. The effect was that a
slot due inside the window produced nothing at all — no card, no record — which
is not "render quietly", it is "silently drop". Keeping the newest slot gives
the user something to answer in the morning without ever escalating.

What it rules out: quiet prompts never chime, notify, open the overlay, or age
into a miss. Louder levels are unaffected outside the window.

### One prompt makes one sound

Decision: the client reminder records when its countdown timer fires and skips
the mount-time escalation for a prompt that arrives within 10 seconds of that
fire.

Why: observed live at Standard — the timer chimed and notified, then
`router.refresh()` mounted the now-pending prompt, whose own effect chimed again,
so one due slot produced two chimes and two notifications. The ref-based guard
keeps the "already waiting when the page opened" chime while removing the
duplicate for a prompt the timer just announced.

### Client timers are read in the browser's timezone

The schedule is stored as local wall-clock strings and the client parses
`nextDueAt` with `new Date(...)`, so the page and the server must agree on the
timezone. Proving the levels in this workspace needed `TZ=America/New_York` on
the server because the preview browser runs in that zone while the container
defaults to UTC; on a single-machine install there is nothing to set. A future
multi-machine or sync feature would have to send an explicit offset instead.

Rollout: five visual-only commits, listed in `docs/design.md`, each green on
`npm test` and `npm run build` before the next. Phase 1's own docs are left as
they are, because they accurately record what was built then.

## 2026-11-08 — Phase 2 voice pass: name the event, not the failure

Decision: an unanswered check-in is now called **unanswered** in the interface
(the day-close row reads "Left unanswered"), not "missed", and the same wording
is used in the helper under the combo. The configuration note on /settings says
what the numbers are and where to change them in plain words instead of talking
about "reviewed with the code". The weekday-detail hint reads "Days as numbers,
Sunday is 0. Try 1,3,5." The voice itself is written down in
`docs/voice-guide.md`.

Why: `docs/roles/voice-writer.md` and `docs/knowledge.md` both forbid shaming
language, and "missed" is the user's word for a failure they did not choose.
"Unanswered" describes the row without judging it and stays accurate for quiet
hours, pauses and reconciliation. The config note was the only line in the
interface written for a developer rather than the person using it.

What it rules out: "missed" as user-facing copy, and any user-facing string that
names a source file unless editing that file is the user's next action.

Open for the owner: the product name and tagline ("One small day at a time.")
are the one pair the voice pass cannot approve on its own; see the note at the
end of `docs/voice-guide.md`.

## 2026-11-09 — Phase 3: a local model proposes, the user decides

### The client is plain fetch against loopback

Decision: `src/ai/ollama.ts` calls `/api/chat` on `http://127.0.0.1:11434` with
the built-in fetch, no SDK. `assertLoopback` throws for any other host before a
request is made; the base URL lives in `src/config.ts`, not in the database.

Why: ARCH-1 forbids outbound calls, and this makes "local only" a checked
property rather than a promise. A fetch client is also the whole API: the app
sends one system message, one user message, `format: json` and two options.

### A proposal table, not a pending AI draft in memory

Decision: planner output lands in `plan_proposal` + `plan_proposal_item`, and a
separate action turns the reviewed items into `task` and `plan_item` rows. Only
a `proposed` row can be accepted, so a double submit adds nothing.

Why: PLAN-3 and ARCH-4 require explicit confirmation, and the review form must
survive a reload. Keeping the proposal also records what the app offered even
after it was accepted or discarded.

### Safety is checked before the model

Decision: `detectDistress` runs first and returns a fixed supportive reading
(category `distress`); the reframe prompt repeats the same instruction for
subtler cases, and a model-chosen `distress` category is replaced by the fixed
reading.

Why: R7 must hold when Ollama is down or the model ignores its prompt. The
user's dump is still stored and deletable, but no micro-action is offered and
the step cannot be added to the plan.

### Dumps are deletable, tasks are kept

Decision: REF-4's delete removes the `brain_dump` row and clears
`task.brain_dump_id`; the task itself stays on the plan.

Why: the dump is the user's private text, while the task is part of the day's
record. Removing the link keeps micro-action XP payable once without breaking the
foreign key.

### Small default model, measured later

Decision: the default is `qwen2.5:1.5b-instruct` with `llama3.2:1b` and
`gemma2:2b` as candidates, and the model name is a settings value. The benchmark
script and test set are committed but were not run this session.

Why: the owner's laptop is modest (R9); 1–2B instruction models are the realistic
range. Storing the name in settings makes swapping models a UI change, and the
fallbacks keep the app usable if the chosen model is slow.

### Re-planning re-orders; it never rewrites the plan

Decision: PLAN-4 sends the open tasks, profile and current time to the model and
accepts only a full permutation of the existing indexes (`parseReplanOutput`).
The order is applied to `plan_item` positions; finished work stays below it, and
the button click is the approval. A missing model, malformed reply or AI-off
setting keeps the current order and says so.

Why: PLAN-4 is about the remaining timeline, not about inventing work, and
ARCH-4 says the model never changes the plan without the user acting. Restricting
the reply to an order makes an unsafe answer impossible to apply. The trade-off
is that the model cannot re-estimate minutes during a re-plan; estimates stay
what the planner proposed and the user accepted.

### Reframe can shrink a chosen task, and micro XP is guarded

Decision: a dump may name one open task (`brain_dump.source_task_id`). Accepting
its step creates the step as a child of that task, and `toggleTask` pays
`micro_action` when a task has either a parent or a brain dump link.
`hasMicroActionEvent` makes that payment once.

Why: PDD §8.3 step 5 says a task involved in the dump is shrunk into a tiny
version, and honesty XP for completing a micro-action is part of the game loop.
The guard closes a pre-existing hole where reopening and re-completing a
shrunken task paid the bonus again.

## 2026-11-10 — Phase 4: insight is derived from the history already kept

### No insight tables

Decision: every Phase 4 view is computed from `day`, `task`, `pulse`,
`habit_occurrence` and `xp_event` at request time. There is no summary table and
no second event store.

Why: INS-1 says reports come from locally logged data only, and the PDD already
treats raw history as the source of truth. A derived table could drift from the
rows the rest of the app is writing. The queries are small for one person and
all use the existing indexes.

### Drift and peak definitions

Decision: a drift moment is a `drifted` answer or a missed pulse. Pivot is a
correction and is not drift. Peak windows look at answered and missed pulses
over 56 days: on-track counts 1, pivot 0.5, drifted/missed 0; an hour needs at
least 3 samples and a 60% score, and adjacent qualifying hours merge into one
window. Weekly integrity is derived with the same `integrityFromDays` rule as
the dashboard; a silent week shows no value rather than a made-up 50%.

Why: these are the only readings the logged data can support without inventing
scores. The thresholds live in `CONFIG.insights` so they can be retuned.

### Peak placement preserves the user's order

Decision: `schedulePlanForPeaks` walks the plan in its existing order and only
moves a heavy task's suggested start to the next peak window; it never reorders,
renames or removes work. `planned_start` is written on the active day, and is
cleared when the user turns peak planning off or no peak has enough history.

Why: INS-3 asks the planner to use peak windows, while PLAN-4/ARCH-4 keep the
user's plan in charge. Times are suggestions and the order remains theirs. The
AI prompt gets the same windows so a model can order heavy work sensibly, but
the deterministic scheduler is what makes the placement true even without a
model.

### Demo history lives in its own database

Decision: `seedHistory` refuses a window that already has days, and the CLI
defaults to `data/seed.db`. The app can point at it with `NIYAM_DB`, so seeding
never touches `data/discipline.db`.

Why: the phase doc explicitly wants seed data for charts, but the owner's real
history is not test data. A separate file makes that boundary structural rather
than a warning. The trade-off is one extra environment variable for manual
review.

## 2026-11-11 — v1 hardening: snapshots, bounded backups and quick keys

### Every export and backup is a SQLite snapshot

Decision: `src/db/backup.ts` uses `VACUUM INTO` for the download route, the
`npm run export` script, the Settings button, and automatic backups. No path
copies the live `.db` file or its WAL directly.

Why: a raw copy of a live WAL database can be torn or need the matching `-wal`
and `-shm` files. `VACUUM INTO` asks SQLite for one consistent database image,
which is openable by any SQLite tool and is what the restore test proves.

What it rules out: treating a filesystem copy as a backup, and exporting a
partially written database. Manual exports live in `data/exports`; deliberate
user exports are not pruned automatically.

### Automatic backups are time- and count-bounded

Decision: `getDatabase()` calls `ensureAutomaticBackup` on database open. A new
backup is written only when the newest one is at least 24 hours old, and
`pruneBackups` keeps the newest 7 by modification time. The live database writes
to `data/backups`; any other database (a seed or `NIYAM_DB` file) writes to a
sibling `<name>-backups` folder. A backup failure is logged and never blocks the
app.

Why: the PDD requires periodic automatic backup and bounded growth, while demo
data must not be able to prune the owner's real history. Modification time is
simple, observable, and works even if a filename is hand-edited.

What it rules out: an unbounded backup folder, automatic backups in the live
folder for demo databases, and a backup failure taking the dashboard down.

### Quick keys act only on the inline prompt

Decision: O answers On track, P answers Pivot, and D answers Drifted on the
inline check-in card. They submit the same server action as the buttons through
a hidden form, and add no note. The mapper in `src/game/shortcuts.ts` rejects
modifier chords, repeats, typing targets, and an open `aria-modal` dialog; the
firm overlay therefore keeps focus. R remains the Reframe shortcut.

Why: the PDD asks for quick keys for the three responses, but the firm overlay
is deliberately a gate and must not lose keystrokes to a second shortcut layer.
Keeping the decision in a pure function makes the suppression rules testable
without a browser.

What it rules out: quick keys firing from the note field, from other text
entries, or while the overlay is open. A response keyed in a hurry does not
silently attach an old note.

### Habit creation timestamps are UTC in storage, local in comparisons

Decision: `habit.created_at` remains SQLite's `datetime('now')` UTC default, but
`dueHabits` converts it to the local calendar date before applying the habit's
created-on rule.

Why: due dates are local days everywhere else. Late in a negative-offset
evening, a freshly created habit could look created "tomorrow" and be hidden
until the next day. Converting at the data boundary fixes existing rows without
rewriting history or changing the schema.

What it rules out: rewriting historical timestamps or treating UTC dates as local
calendar dates.

## 2026-11-12 — Live acceptance: model choice and readiness

### qwen2.5:1.5b-instruct remains the default after the three-model benchmark

Decision: keep `qwen2.5:1.5b-instruct` as the default. The benchmark over the
eight committed planner/reframe cases produced:

| Model | Median reply | Structured |
| --- | --- | --- |
| `qwen2.5:1.5b-instruct` | 758 ms | 8/8 |
| `llama3.2:1b` | 454 ms | 7/8 |
| `gemma2:2b` | 3,485 ms | 8/8 |

Why: qwen was the fastest model with a perfect structured reply rate. llama was
faster but missed one reframe schema; gemma was reliable but much slower. The
model remains editable in Settings, and the full table is in
`docs/ai-benchmark.md`.

What it rules out: treating a running Ollama server as proof that the selected
model is usable, and choosing a model from speed alone.

### Readiness requires the configured model, not just a running server

Decision: `checkLocalModel` now checks `/api/tags` for the exact configured model
name before reporting ready. The predicate is `modelIsInstalled` in
`src/ai/ollama.ts`, covered by a unit test (`dfc3fed`).

Why: during live setup Ollama was running with zero models installed, and
Settings said “The local model answered. It is ready.” Every AI action would
have failed. A server probe is not a model probe.

What it rules out: reporting readiness from server health alone; a missing or
misspelled model now shows the existing “did not answer” state.

## 2026-11-12 — Follow-up hardening: bad values, exact re-plans and completion

### An out-of-range model value is malformed, not something to clamp

Decision: `parsePlannerOutput` rejects planner minutes outside 5–180 and
`parseShrinkOutput` rejects shrink minutes outside 1–15. A reply containing one
is treated like any other malformed reply: the generator falls back and the
fallback marking is stored where the path has one. Review edits are still
clamped by `acceptProposal`, because those values come from the user.

Why: a valid-shaped reply with `0` or `999` minutes is not trustworthy just
because it parses. The stub run showed the old clamp would have stored a
180-minute task with `fallback = 0`; rejecting the reply keeps the documented
fallback promise. The previous unit test that asserted clamping was changed to
assert rejection.

What it rules out: treating any finite number as usable model output, and
silently turning an absurd estimate into a plausible-looking task.

### Re-plan prompts state the exact index count

Decision: `prompts/replan.md` now receives `count` and `last` and says that the
shape example has three indices only as an example. `generateReplan` fills both
from the actual open items. The test asserts a two-item prompt says “exactly 2
tasks” and “from 0 to 1”.

Why: during the live normal-path run, qwen returned `{"order":[1,0,2]}` for two
tasks. The parser was right to reject the invented index, but the prompt's
shape example showed three indices and never named the count. Being strict in
validation without giving the model the right bound caused a needless fallback.

What it rules out: copying the example order length instead of deriving it from
the actual remaining work.

### Completion notices are once per task and permission-gated

Decision: a task's first completion redirects with `?completed=<id>`.
`CompletionWatcher` creates one browser notification only when permission is
already `granted`, and `completionNotice` rejects any task already in its set.
A per-task `sessionStorage` key keeps reloading that URL quiet. Reopening and
re-completing does not carry the query again because `hasTaskCompletionEvent`
is checked before the redirect. The watcher never asks for permission itself.

Why: the game loop rewards finishing a thing, but a second notice for the same
finish would be noise, and reopening a task must not replay the reward feel.
Using the existing XP completion event as the server-side once check makes the
notification and the ledger agree.

What it rules out: completion notices on reopen/re-complete, notices from a
blocked permission, and a completion prompt hijacking the check-in permission
flow.

### Past peaks are not moved into tomorrow

Decision: `assignPlannedStarts` only looks for a peak that starts at or after
the current cursor. If every peak is already past, a heavy task keeps the
current time and the plan stays sequential; it never invents a tomorrow peak.
Tests pin the after-peaks case, a partly-past peak and an all-heavy plan that
exceeds peak capacity.

Why: `planned_start` is a clock time for today, and the plan is not a multi-day
scheduler. Dropping or reordering work to force a peak would be worse; all four
heavy tasks are retained. The comment now matches this behavior.

What it rules out: silently scheduling into a future day, dropping heavy tasks
when peaks are full, or treating a past peak as usable.

## 2026-11-12 — Visual redesign: cozy pixel farm

Decision: `docs/redesign.md` now governs interface chrome and supersedes the
earlier "no pixel art" line for this visual pass. The product keeps its warm,
calm material language but gains hard-edged pixel panels, original inline-SVG
sprites, a wooden sign, inventory tabs, a mascot-led check-in dialogue, HUD
gauges, a quest log and a habit garden. Visual only: no action, schema, route,
scoring, scheduling or persistence behaviour changed.

Adaptations made to fit the project rules:
- The display and body faces are self-hosted rather than loaded from Google
  Fonts at runtime: `public/fonts` contains Pixelify Sans and Nunito (latin
  WOFF2) with their OFL licences, and `globals.css` declares both with
  `font-display: swap`. The spec explicitly allows self-hosting, and this keeps
  the project's no-outbound-request rule intact.
- All art is original CSS or inline SVG; no game asset or sprite sheet is
  copied or fetched.
- The crop stage uses the existing per-habit streak: 0 = seed, 1 = sprout,
  2–3 = small plant, 4–6 = flowering, 7+ = harvest-ready. The done-today
  sparkle comes from a completed plan task carrying that habit id.
- Reward feedback is client-only and visual: the task XP shown is the configured
  XP for the completed task's load; level-up/combo animation state is kept in
  `localStorage`. No score is calculated or stored by the redesign.
- The existing interruption-level audio remains. The spec's "no sound by
  default" conflicts with the shipped Standard level, so the instruction to keep
  behaviour wins; no new audio or settings switch was added.
- Existing level names and thresholds are unchanged. The farm-flavoured level
  ladder was optional and would have changed product identity strings.
- The shared day plaque maps draft to the existing Draft copy, a paused active
  plan to Paused with the amber dot, and closed to Closed with the grey dot. It
  reads pause windows on every screen; Settings uses the existing read-only day
  lookup so it never creates a day just to show a plaque.
- The garden uses the existing per-habit streak for crop stage, and a completed
  plan task carrying that habit id for the done-today sparkle. Each habit name
  is on a parchment nameplate beneath its crop, and its two actions split the
  tile width so neither label can clip.
- Below 520px the HUD keeps the same three gauges but drops the combo cue and
  integrity caption, which already appear in the check-in and heat panels. This
  keeps the signature check-in in the first screen instead of below a tall stack
  of explanation.

Verification (2026-11-13): `npm test` is 156/156 and `npm run build` passes after
the final fixes. Headless Chromium at 375, 768 and 1440 covered the four routes
with no horizontal overflow and both local fonts loaded. The run exercised due,
paused, overdue/missed, closed, done-today, XP gain, level-up, combo gain, combo
reset and reduced-motion states; hover, keyboard focus, pressed and disabled
controls; and real clicks on a header tab and on the quest's Mark done action.
Effective checkbox targets measured 44px high through their labels, focus rings
are a 3px water outline at 2px offset, all visible leaf text passed a computed
AA contrast audit on every route (with manual checks for the gradient sky and
due-state surfaces), no display font is below 13px, no radius exceeds 4px and no
shadow has blur. Screenshots are in the ignored `data/redesign-shots/cdp`
folder. The existing audio behaviour and level ladder are deliberately unchanged,
and the redesign still alters no scoring or persistence rule.

## 2026-11-13 — Tray Quit is driven, not assumed

Quit is the only way out of the desktop app, so it is now exercised the way a
user exercises it: `desktop/spike/tray-quit.mjs` attaches to the main process
over its inspector, takes the Quit `MenuItem` out of the menu the tray actually
shows, and calls it with Electron's own `(menuItem, browserWindow, event)`
signature. Run with the window hidden and the server up, the log reads
`quit requested (grace armed)` → `grace timer cleared` → `tray removed` →
`server child stopped`, and no Electron or server process survives; run after the
grace had already stopped the server, the same path reports `grace idle`, removes
the tray and leaves nothing behind, with the grace never firing afterwards.

The tray keeps the ids it shows (and returns its menu), which is what makes that
possible; the mapping from menu data to template is pure and unit-tested. The
hook that hands the live tray to the inspector is behind `NIYAM_DEBUG_TRAY=1`.

The icon is a 32×32 RGBA PNG, 175 bytes, valid signature, `nativeImage` reports
it non-empty with size 32×32 — but nobody has looked at the pixels.

## 2026-11-13 — Desktop phase 3: the app lives in the tray

Decision: the window is no longer the app. Closing it hides it, a tray icon
stays, the server keeps running for **two minutes** and then stops, and Quit
from the tray is the only way to end the process.

- **Tray menu is Open and Quit**, nothing else. Autostart is deliberately absent:
it only becomes useful once the background check-in exists, so it is a Phase 4
decision rather than a checkbox with nothing behind it.
- **Close hides** and says so **once**, on the first ever close, via a local
notification backed by `desktop-state.json` in the app's userData folder. After
that the app hides silently.
- **The server stops after the grace window** (2 minutes) and starts again on the
next Open, reusing the Phase 2 supervision path. Until Phase 4, that means no
check-ins are generated while the window is closed.
- **The icon is a 32 px pixel sprout** generated by `desktop/assets/make-tray-icon.mjs`
from the existing palette and committed. No art is fetched, and it does not
change state yet.
- **Uninstall will ask** whether to keep history (Phase 5).

Measured footprint, and a correction worth recording: a hidden app is **255–319 MB
working set (117–219 MB private)** across the main, GPU and utility processes.
Phase 0's 59 MB figure was an app that had **never** created a window, so it had
no GPU or utility process; once a window has existed, Chromium keeps those
processes for the life of the app. `--disable-gpu` lowers the private total from
219 MB to 117 MB and does not remove the GPU process. The earlier "under 60 MB
closed" target is therefore **not** met by hide-to-tray and is reopened for the
Phase 4 plan, where the alternative is a small agent that does not keep Electron
alive at all.

## 2026-11-13 — Voice pass: one name per thing, on screen and in the prompts

Decision: every route, `src/copy.ts` and the four prompt files were read against
`docs/voice-guide.md`. The pass changed wording only, and fixed the places where
a label meant two things, described the wrong event, or spoke in stored slugs.

- The settings page has its own lede instead of reusing the check-in interval
  hint ("Between 5 and 240..."), which described a field, not the page.
- A paused day gets its own "Paused" plaque label instead of borrowing the habit
  pause tag. The three interruption levels now say what the user will experience
  ("a quiet note on the page", "a note and a soft chime", "a full-screen
  check-in") instead of interface jargon.
- The AI-off notice appears once per screen, and AI context passes "Low-energy
  rescue" and "On track" instead of the stored `low_energy` and `on_track`
  slugs, so the model reads the product's vocabulary.
- Insights describe what happened: "moments drifted" and "check-ins went
  unanswered" are separate counts (a missed slot is not a drifted answer), the
  heat-map tooltip splits "drifted" from "unanswered", "across 2 active days"
  became "on 2 days", and the trends legend says integrity blends answered
  check-ins with finished tasks. That is what `integrityFromDays` computes; the
  old line said it blended consistency and combo.
- Empty, idle and failure states keep a next step: the idle check-in says the
  next one comes on its own, AI off says to turn it on in Settings, and the
  backup panel no longer prints its empty state twice or repeat the interval.
- Habit "Detail" became "Schedule detail" with an "Optional" placeholder and one
  hint that is true for every frequency. The old placeholder told every user
  that weekdays are numbers, including when they picked "Every few days".
- One word, one key: the insights habit list now reuses the habits empty state
  and pause tag rather than carrying identical copies.
- Prompt rules now match the copy: a shrink step takes under five minutes, so
  `prompts/shrink.md` asks for 1–5 minutes and a verb-first title, and
  `prompts/reframe.md` states the no-blame voice the diagnosis must follow.

Why: the guide promises one word for one thing, and that every state says what
happened without judging it. Those held sentence by sentence but not across
screens, and two insight lines counted unanswered check-ins as drift, which
contradicts the product's own "unanswered" vocabulary.

What it rules out: reusing a field hint as page copy, borrowing a label from a
different feature, duplicating an identical message or empty state under a
second key, and letting prompt context leak stored slugs.

Verification: `npm test` 156/156 and `npm run build` pass. No route, action,
schema or scoring behaviour changed.
