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
