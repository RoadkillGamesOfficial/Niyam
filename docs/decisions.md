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
