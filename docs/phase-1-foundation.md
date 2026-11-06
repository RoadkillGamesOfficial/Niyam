# Phase 1: Local Foundation

Prerequisites: `knowledge.md` and `docs/PDD.md` loaded. Nothing built yet.

## Goal
Establish the local system end to end: a web page, a server, and a SQLite file that work together on one laptop, with no network dependencies.

## In scope
- Next.js + React + TypeScript project setup, with a README containing run instructions.
- SQLite initialized as a single local file, with a simple migration approach.
- A schema covering Task and Day, plus a session marker table, shaped to match the PDD data model (Section 10) so later phases extend it rather than replace it.
- One page: add a task, list tasks, mark a task done.
- Minimal terminal-inspired styling (dark theme, monospace). Keep it light; the full design comes later.
- All UI strings in one central copy file (for example `src/copy.ts`).
- A basic test setup with tests for the data layer.

## Out of scope
Check-in timer, XP, combo, levels, integrity, habits, AI/Ollama, insights, screen time import, notifications.

## Suggested order
1. Project scaffold and run instructions.
2. Database initialization and migration approach.
3. Schema for Task, Day, session markers.
4. Data-access layer with tests.
5. Add/list/done UI wired to the data layer.
6. Restart and refresh verification.

## Acceptance (all must pass)
- A task entered in the UI appears in the local database file.
- It displays back correctly after a page refresh and after restarting the app.
- Marking a task done persists.
- The app runs with no internet connection.
- Tests for the data layer pass.

## Handoff
Update `docs/handoff.md` (state, how to run, open questions) and `docs/decisions.md` (stack and schema decisions). Run the reviewer role before starting Phase 2.
