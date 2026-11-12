# Live acceptance — 2026-11-12

Status: **passed**, with one readiness defect found and fixed during the run.

## Environment

- Windows, Node 24.21.0, Next.js 16.4.5 production build (`npm start`).
- Ollama 0.40.16 at `http://127.0.0.1:11434`.
- Models installed: `qwen2.5:1.5b-instruct`, `llama3.2:1b`, `gemma2:2b`.
- Isolated databases: `data/phase3-test.db` for the draft/day flows and
  `data/live-test.db` for seeded history. Both were created with
  `npm run seed -- --db <path> --fresh`; `data/discipline.db` was not touched.
- `npm test`: **131/131 passed, 0 failed**. `npm run build`: passed.
- Browser driven directly against the production server, with the database
  selected through `NIYAM_DB`.

## Model benchmark

`node scripts/benchmark-ai.mjs --out docs/ai-benchmark.md`, over the eight
planner/reframe inputs in `docs/ai-test-set.json`:

| Model | Median reply | Structured |
| --- | --- | --- |
| `qwen2.5:1.5b-instruct` | 758 ms | 8/8 |
| `llama3.2:1b` | 454 ms | 7/8 |
| `gemma2:2b` | 3,485 ms | 8/8 |

`qwen2.5:1.5b-instruct` remains the default: it was the fastest model with a
perfect structured reply rate. `llama3.2:1b` was faster but missed one reframe
schema; `gemma2:2b` was reliable but roughly 4.6 times slower.

## Phase 3 — local AI

| Path | Result |
| --- | --- |
| Settings readiness | With no models installed, the check correctly showed `down`; with qwen installed, it showed the ready notice. This exposed and fixed the old server-only check (`dfc3fed`). |
| Planner | A messy multi-task paragraph became five validated items (`fallback = 0`). Zero tasks were saved before confirmation. |
| Review | A title and minutes were edited and one item was unticked; accepting saved exactly the four remaining tasks, in order, with the edited values. |
| Re-plan | Live model reordered the open work (report first, dentist later) and left the completed task last. |
| Re-plan fallback | With Ollama stopped, the order was unchanged and the page showed the fallback notice. |
| Reframe | Live dump returned category `avoidance`, a short diagnosis and one action; `fallback = 0`. “Another angle” changed the reading and kept the user's text unchanged. |
| Reframe task link | The dump was tied to “Rewrite the opening of the report”; accepting the step created a 5-minute light child task and a plan item. |
| Reframe edit/delete | Editing the dump regenerated the reading. Deleting the dump left the task and child task in place and cleared the dump link. |
| Micro-action XP | Completing the step wrote `task_done` 15 + `micro_action` 5. Reopening and completing again did not add another micro-action event. |
| Shrink | Live Drifted → “Ask for a smaller step” created a model-written 5-minute child. With Ollama stopped, the preset “Clear one thing from the desk” was created instead. |
| Planner fallback | With Ollama down, the messy list became a plain split (`fallback = 1`), still reviewed before save; discard left zero tasks. |
| Reframe fallback | With Ollama down, the reading was stored with `fallback = 1` and the page said so. |
| Safety | A distress dump returned the fixed supportive response with `safety = 1`; no productivity step or accept action was offered. |
| AI off | Turning local AI off persisted, hid the planner, shrink and reframe controls, and showed the reframe off notice. Turning it back on restored them. |
| `R` shortcut | On the dashboard, `R` opened `/reframe`. |

## Phase 4 — insights and peak scheduling

Seeded history: 84 days (2026-08-19 to 2026-11-10), 312 tasks and 924 check-ins.

| Check | Rendered result | Direct SQL |
| --- | --- | --- |
| Drift heat map | 290 drift moments across 913 check-ins | 913 total, 839 answered, 74 missed, 290 drift |
| Profile completion | Sprinting 86/120 (72%); Maintenance 86/144 (60%); Low-energy 23/48 (48%) | same |
| Peak windows | 09:00–12:00 (81%); 13:00–14:00 (70%) | same, from 56 days |
| Weekly trends | Eight rows, 21 Sept–9 Nov; consistency 95, 88, 95, 95, 92, 90, 90, 86%; combos 5, 5, 4, 7, 6, 7, 9, 3 | same |
| Habit insights | Make the bed 50/55 (91%); Walk 20/55 (36%); Plan tomorrow 23/39 (59%) | same; pending occurrences excluded |

- Peak planning **off**: `planned_start` was null for every item in both the
  draft and the started day.
- Peak planning **on**, day started at 08:00: the heavy task moved to `09:00`
  inside the `09:00–12:00` peak; plan order stayed unchanged.
- `/insights` responded in **32–65 ms** over five requests and rendered 58 KB.
- The rendered observations reported counts and next steps without failure or
  judgment language.

## v1 hardening

- Settings → Download a snapshot returned a 372 KB SQLite file with
  `application/vnd.sqlite3` and the expected attachment name; it opened with 312
  tasks and 85 days.
- Settings → Back up now wrote a second snapshot to
  `data/live-test-backups`.
- O, P and D each answered the inline prompt in the browser and wrote the
  expected response/XP: On track +10, Pivot +5, Drifted +3.
- Typing `o` in the note field left the pulse pending; the key only worked after
  the field lost focus.
- `R` opened Reframe.

## Limits

- Peak placement only uses a peak that is still ahead today. A day started after
  both peaks kept sequential times; the measured placement was made at an 08:00
  start. Scheduling into the next day is out of scope for `HH:MM` plan times.
- The benchmark is a single run per case on this laptop, not a statistical
  sample.
- Malformed-output handling is covered by the offline validation tests; no
  synthetic malformed server was injected during the browser run.
- OS-level notification delivery was not re-tested in this run; the earlier
  Phase 2 record still applies.
- An independent reviewer pass remains pending.
