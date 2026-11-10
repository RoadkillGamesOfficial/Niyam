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
