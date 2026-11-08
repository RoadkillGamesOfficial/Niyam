# local-discipline-companion

A local-first discipline companion. One page, one SQLite file, no accounts, no
network calls while it runs. This is Phase 1 (local foundation): add a task for
today, see the list, mark a task done.

## Requirements

- Node.js 24 or newer. The app uses the built-in `node:sqlite` module for the
  database and `node:test` for tests, so there is nothing to compile natively.

## Run it

```sh
npm install
npm run dev
```

Open the URL the dev server prints. Next picks a free port, so it is not always
3000; read the banner rather than guessing.

## Where the data lives

`data/discipline.db` — a single SQLite file, created on the first page load and
ignored by git. Everything you type lives only in that file, so back it up by
copying it.

Deleting `data/` is the only way the app removes anything. It never deletes or
rewrites rows on its own.

## Checks

```sh
npm test        # data-layer tests, each against a throwaway database
npm run build   # production build, which also runs the type check
```

## Notes

- The database layer runs on the Node runtime only: never import `src/db/` from
  a `"use client"` file or run it on the edge runtime.
- Next.js would collect anonymous telemetry during `dev` and `build`, so the
  npm scripts run it through `scripts/next.mjs`, which sets
  `NEXT_TELEMETRY_DISABLED=1` before starting the CLI. Nothing the project runs
  makes an outbound request; the wrapper exists because an inline `VAR=1` prefix
  does not work in Windows `cmd`.
