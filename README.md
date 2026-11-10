# local-discipline-companion

A local-first discipline companion. One page, one SQLite file, no accounts, no
network calls while it runs. Phases 1–4 are implemented, with live testing still
pending for the local-AI and insight layers: a manual plan with a Daily Profile,
check-ins with XP and combo, habits, settings, a day close, an Ollama planner and
Reframe flow with fallbacks, and a local insights view with peak-window planning.

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

Apart from an explicit brain-dump delete, the app never removes history on its
own; deleting `data/` removes the whole local record.

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

## Insights (Phase 4)

`/insights` reads the local history and shows a drift heat map by hour and
weekday, completion under each Daily Profile, eight weeks of consistency / combo /
integrity, per-habit completion with gentle next steps, and detected peak
windows. Today, this week, and last week each get a short observation in plain
language.

Peak-window planning defaults on and can be switched off at /settings. When it
is on, starting or editing the plan adds suggested start times and moves heavy
tasks to the next detected peak without changing the plan order. With it off, no
suggested times are written and planning keeps its usual order. A local model is
not required for any of this.

To review the views with months of history without touching real data:

```sh
npm run seed -- --db data/seed.db --fresh
NIYAM_DB=data/seed.db npm run dev
```

The seed generator writes closed days, tasks, check-ins, XP and habits into a
separate file; it refuses a window that already has days. `NIYAM_DB` is the only
way the app points at another database.

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
