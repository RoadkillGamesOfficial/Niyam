# local-discipline-companion

A local-first discipline companion. One page, one SQLite file, no accounts, no
network calls while it runs. Phase 1 (local foundation) and Phase 2 (game loop)
are complete: a manual plan with a Daily Profile, check-ins with XP and combo,
habits, settings and a day close. Phase 3 (local AI) is implemented and awaiting
a live run: an Ollama planner with review, Reframe brain dumps, AI task
shrinkage, validation, fallbacks and an AI on/off switch.

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

## Local AI (Phase 3, optional)

The app works fully without a model. To use the AI features, install
[Ollama](https://ollama.com) and pull a small model:

```sh
ollama pull qwen2.5:1.5b-instruct
ollama serve   # usually already running after install
```

Then set the model on /settings (default `qwen2.5:1.5b-instruct`; `llama3.2:1b`
and `gemma2:2b` are the other candidates) and use "Check the model". Everything
runs through loopback; the client refuses any other host.

With a model running:

- The draft plan panel accepts a messy list. The model proposes tasks; you edit,
drop or accept them, and nothing saves until you accept.
- `/reframe` (or the `R` key) turns a brain dump into a reading and one small
step, keeps past dumps, and offers another angle. It can be tied to a task so the
step becomes a shrunken version of it.
- The Drifted panel's "Ask for a smaller step" shrinks the current task; preset
steps are kept as the fallback.
- "Re-plan the rest" asks the model for an order for the remaining tasks and
keeps the current order if it cannot answer.

When Ollama is stopped or slow, each feature falls back to a plain version and
tells you so.

To compare models on this laptop, with Ollama running:

```sh
node scripts/benchmark-ai.mjs
node scripts/benchmark-ai.mjs --out docs/ai-benchmark.md
```

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
