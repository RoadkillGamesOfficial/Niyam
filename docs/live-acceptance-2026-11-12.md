# Live acceptance — 2026-11-12

Status: **passed**, with one readiness defect found and fixed during the initial run,
and a follow-up malformed-output, scheduling-edge and completion-notification
pass recorded below.

## Environment

- Windows, Node 24.21.0, Next.js 16.4.5 production build (`npm start`).
- Ollama 0.40.16 at `http://127.0.0.1:11434`.
- Models installed: `qwen2.5:1.5b-instruct`, `llama3.2:1b`, `gemma2:2b`.
- Isolated databases: `data/phase3-test.db` for the draft/day flows and
  `data/live-test.db` for seeded history. Both were created with
  `npm run seed -- --db <path> --fresh`; `data/discipline.db` was not touched.
- `npm test`: **131/131 passed** in the initial run and **156/156 passed** after
the follow-up pass. `npm run build`: passed both times.
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

- The benchmark is a single run per case on this laptop, not a statistical
  sample.
- OS-level notification delivery still was not visually observed. The
  completion notification is covered by an automated guard test and a browser
  probe that counts constructor calls; no OS banner was inspected.
- Peak placement only uses a peak still ahead today. The after-peaks and
  partly-past-peak cases are pinned by tests in the follow-up section; scheduling
  into tomorrow is intentionally out of scope for `HH:MM` plan times.
- A shrunken task has no `fallback` column. Its stored title is the deterministic
  preset step, never the model's title, but the row cannot carry a boolean marker.
- An independent reviewer pass remains pending.

## Follow-up pass — malformed replies, scheduling edges and completion notice

Run on 2026-11-12 after the initial acceptance, against
`data/malformed-test.db` and `data/normal-test.db`; `data/discipline.db` was not
touched. Final `npm test`: **156/156 passed**; `npm run build`: passed.

### Method

Ollama was stopped. `scripts/ai-stub.mjs` listened on the unchanged configured
address, `127.0.0.1:11434`, and served `/api/tags` plus switchable `/api/chat`
replies through its `/control?mode=` endpoint. The production build ran with
`NIYAM_DB` pointing at the throwaway file, and the real planner, re-plan,
reframe and shrink forms were submitted in the browser. Modes were `invalid`,
`truncated`, `wrong` and `absurd`. Rows were read back with `node:sqlite`.

### Malformed-model matrix

| Path | Cases | Actual stored result |
| --- | --- | --- |
| Planner | invalid JSON, truncated JSON, wrong-schema JSON, 999-minute task | Proposals 1–4 all `fallback = 1`, `status = discarded`; each held the two local-split items; `task` had 0 rows at this point. |
| Re-plan | invalid JSON, truncated JSON, wrong-schema JSON, duplicate order | Every response redirected with `replanFallback=1`; `plan_item` stayed position 1 = First task, position 2 = Second task; no row was written for the attempt. |
| Reframe | invalid JSON, truncated JSON, wrong-schema JSON, 400-character action | Dumps 1–4 all `fallback = 1`, `category = overwhelm`, `safety = 0`; no task was created. |
| Shrink | invalid JSON, truncated JSON, wrong-schema JSON, 999-minute step | Tasks 3–6 were the preset “Open the file and read one line”, 5 minutes, `parent_task_id = 1`; no model title such as “Absurd” was stored. |

The UI showed the existing plain-language fallback notices, never raw JSON or a
model error. The stub log confirms the JSON retry for the invalid and truncated
replies (`invalid planner` twice, for example) and one attempt for valid JSON
that failed schema validation. The empty-task-list absurd case is covered by
the HTTP-boundary test but was not repeated in the browser.

`parsePlannerOutput` and `parseShrinkOutput` now reject a duration outside
their documented ranges (planner 5–180, shrink 1–15) instead of silently
clamping it. That makes 0/999 a fallback case at the model boundary; a user's
review edit is still clamped by `acceptProposal`.

### Normal model path after switching back

Ollama 0.40.16 was restarted and the same UI was exercised on the normal
database:

- Planner: `fallback = 0`; proposal stored two model items (25 and 30 minutes).
- Re-plan: the first live attempt fell back because qwen returned
  `{"order":[1,0,2]}` for **two** tasks. The parser correctly rejected the
  invented third index, but the prompt's shape example itself had three
  indices. The prompt now states the exact count and 0..N−1 range; re-running
  produced no fallback and the plan became Write opening → Email Sam.
- Reframe: `fallback = 0`, category `avoidance`, stored dump 1.
- Shrink: model step “Start writing the opening of the report”, 5 minutes,
  `parent_task_id = 2`.
- Completion: task 1 wrote `task_done` 30 once; reopen/re-complete added no XP
  and no second notice. Task 2 completed under a denied permission with no
  notice.

### Scheduling edges

No production behaviour change was needed. The code only looks for a peak whose
start is at or after the cursor, so an already-finished day cannot invent a peak
in tomorrow's `HH:MM` plan. The comment now says so explicitly, and new tests pin
the behavior:

- `treats a peak that is partly past as available from the current time`:
  starting 10:30 inside 09:00–12:00 gives 10:30, 11:35, then 13:00 in the next
  peak.
- `keeps all heavy work when peaks cannot hold it`: four 60-minute heavy tasks
  with 09:00–10:00 and 13:00–14:00 peaks give 09:00, 13:00, 14:05, 15:10, with
  all four retained and the order unchanged.
- `leaves starts sequential when the day begins after every peak`: seeded
  09:00 samples create a real peak, a 16:00 start gives 16:00 and 16:50, and the
  plan remains Heavy first → Heavy second.

### Completion notification

`src/game/completions.ts` returns a notice only for a granted permission and a
task not already in the caller's set. `CompletionWatcher` fires it only for the
server's first-completion redirect, and stores a per-task session key so a
reload of the same URL stays quiet. It never asks for permission itself; the
existing check-in permission flow owns that prompt.

The automated tests are `fires once per task, including after a reopen and
re-complete` and `stays silent when permission is denied or has not been asked`.
In the browser, a fake `Notification` constructor counted one notice for the
first completion, still one after reopening and re-completing the same task, and
still one when a second task completed with permission set to `denied`. No OS
banner was inspected.

### Mutation checks

Each new guard was removed once, the focused tests were run, and the guard was
restored:

| Removed guard | Focused result |
| --- | --- |
| Completion already-notified check | 1 failed / 2 passed |
| Next-peak lookup | 4 failed / 12 total in `insights.test.ts` |
| Shrink duration range check | 2 failed / 42 across `ai.test.ts` and the HTTP-boundary tests |

After restoration, all focused tests passed and the full **156/156** suite and
production build passed again.
