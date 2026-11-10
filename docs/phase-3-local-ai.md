# Phase 3: Local AI Integration

Status: **implemented 2026-11-09, pending live testing.** The model itself has
not been run yet, by request; the offline rules, schema and fallbacks are
covered by tests. See "What landed" at the end for files and deviations.

Prerequisites: Phase 2 accepted and reviewed. Read PDD Sections 8.1, 8.3, 11, and 12.

## Goal
Connect the app to a local model through Ollama so messy text becomes a plan and a brain dump becomes a diagnosis and one micro-action, entirely offline.

## In scope
- **Model selection:** benchmark candidate local models on the actual laptop (response time, structure reliability, usefulness) using a test set of realistic messy task inputs and brain dumps. Record the choice and results in `docs/decisions.md`.
- **Ollama connection** over local loopback only.
- **Planner:** unstructured text to tasks with duration estimates, Cognitive Load, ordering, and chunking, tuned to the Daily Profile (PLAN-1, PLAN-4). The user reviews and confirms before anything is saved (ARCH-4).
- **Reframe (brain dump):** reachable from any screen via a shortcut and from Drifted. Returns a diagnosis category, one micro-action, and an optional shrunken task (REF-1 to REF-6). Completing a micro-action awards XP.
- **Task Shrinkage** using AI, replacing the Phase 2 presets (presets remain as fallback).
- **Validation and fallback:** all model output is structured and validated; malformed output is retried, then rejected. If the model is unavailable or slow, the app falls back to manual planning and preset micro-actions (ARCH-2, ARCH-3, PLAN-5).
- **Prompts:** written by the voice writer role, stored in separate prompt files (not buried in code), short and specific.
- **Safety behavior:** if a brain dump shows signs of serious distress, drop the productivity framing and gently suggest reaching out to a trusted person or professional support (Risk R7).
- Brain dumps stored locally and viewable, editable, and deletable by the user.

## Out of scope
Insights views, peak-window scheduling, screen time import.

## Suggested order
1. Test set and model benchmark.
2. Ollama client with timeout and error handling.
3. Output schemas and validation.
4. Planner prompt and flow.
5. Reframe prompt and flow, including the safety path.
6. Shrinkage integration and fallbacks.
7. Voice review of all prompts and output.

## Acceptance
- A chaotic paragraph becomes a structured, editable plan; nothing saves without confirmation.
- A brain dump returns a short, specific diagnosis and one micro-action.
- No outbound network calls are made (verify).
- With Ollama stopped, every feature still works in fallback mode.
- Malformed model output never reaches the UI or the database.
- Safety path triggers on distress-signal test inputs.

## Handoff
Update `docs/handoff.md` and `docs/decisions.md`. Run the reviewer and the voice writer before Phase 4.

## What landed (2026-11-09)

Built without running a model, as requested. Everything needed to test is in
place:

- **Ollama client** (`src/ai/ollama.ts`): plain `fetch` against
  `http://127.0.0.1:11434`, no dependency. The address is checked to be loopback
  before every request. One retry on malformed JSON, a 60-second timeout, and a
  2.5-second health probe used by Settings.
- **Model choice** (`src/config.ts`): default `qwen2.5:1.5b-instruct`, candidates
  `qwen2.5:1.5b-instruct`, `llama3.2:1b`, `gemma2:2b`. The choice is stored in
  `settings.ai_model` and editable in Settings, so trying another model needs no
  code change.
- **Planner**: a textarea in the draft plan panel, a validated proposal, and a
  review form where each item can be edited, excluded, or discarded. Nothing is
  written to `task`/`plan_item` until the review is accepted (PLAN-3, ARCH-4).
  "Re-plan the rest" on a running day asks the model for a new order of the
  remaining work (PLAN-4), keeping the current order when it cannot answer.
- **Reframe**: `/reframe`, linked from both mastheads and reachable with `R` on
  any page. Stores the dump and its reading in `brain_dump`; the reading can be
  regenerated for another angle, the text can be edited, and the dump can be
  deleted. The accepted step becomes a 5-minute task linked back to the dump.
- **Shrinkage**: the Drifted panel gains "Ask for a smaller step", which asks
  the model for one step and falls back to the Phase 2 presets.
- **Validation and fallback** (`src/ai/validate.ts` and the three generators):
  planner replies are capped at 12 items, titles at 200 characters, minutes
  clamped to 5–180; reframe categories are a fixed set (with the PDD prose names
  accepted); a failed or unavailable model falls back to a local split, a plain
  reading, or a preset step, and the UI says so.
- **Safety** (`src/ai/safety.ts`): explicit distress phrases short-circuit the
  model and return the supportive response; the prompt also asks for a
  `distress` category, which is replaced by the same fixed response. A safety
  reading never offers a productivity step and is not turned into a task.
- **Settings**: a Local AI panel with an on/off switch, the model field, and a
  "Check the model" button that probes Ollama without blocking page loads.
- **Benchmark**: `scripts/benchmark-ai.mjs` runs `docs/ai-test-set.json` against
  the candidates and prints time and structure pass rate; `--out` writes a
  markdown table. It has not been run.
- **Data**: migration `003_phase3.sql` adds `brain_dump`, `plan_proposal`,
  `plan_proposal_item`, the AI settings columns and `task.brain_dump_id`;
  `004_phase3_reframe_task.sql` adds `brain_dump.source_task_id`.

Deviations from the suggested order: the benchmark script exists but was not
run (no model runs this session), and the prompt files are `prompts/planner.md`,
`prompts/reframe.md` and `prompts/shrink.md` rather than templates inside code.

Still to do: run the benchmark and record the chosen model in
`docs/decisions.md`, then exercise the acceptance list above on a running app.

## Requirement map (audit 2026-11-09)

Every Phase 3 requirement, the code that implements it, and the user path that
reaches it. Verified statically: build and unit tests pass, no model or browser
was run.

| Requirement | Implementation | User path |
| --- | --- | --- |
| Model benchmark and recorded choice (R9) | `scripts/benchmark-ai.mjs`, `docs/ai-test-set.json`, `CONFIG.ai.candidates` | `node scripts/benchmark-ai.mjs`; choice editable at /settings. Run pending. |
| Ollama on loopback only (ARCH-1) | `src/ai/ollama.ts` `assertLoopback`, `CONFIG.ai.baseUrl` | every AI form; a non-local address throws before a request |
| PLAN-1 text to structured tasks | `src/ai/planner.ts`, `src/ai/validate.ts`, `proposePlan` | Today (draft) → "Shaping a messy list" → review |
| PLAN-4 re-plan the rest | `src/ai/replan.ts`, `reorderOpenItems`, `replanWithAi` | Today (running) → "Re-plan the rest" |
| Planner tuned to the Daily Profile | profile guidance in `prompts/planner.md`, profile in `replanWithAi` | profile picker on the draft plan |
| PLAN-3 / ARCH-4 confirm before save | `plan_proposal` + `plan_proposal_item`, review form, `acceptPlanProposal` | review → "Add these to the plan" |
| REF-1 one action from any screen | `R` handled in `reframe-shortcut.tsx`; Reframe link in every masthead | any page |
| REF-2 diagnosis, one step, optional shrunk task | `generateReframe`, `brain_dump` reading, task selector, `acceptMicroAction` (parent task) | /reframe → "Put this step on the plan" |
| REF-3 short and specific | prompt rules; validation caps diagnosis at 400 and the step at 300 | model output shown only after validation |
| REF-4 dumps stored, viewed, edited, deleted | `src/db/brain-dumps.ts`, uncapped past-dump list, edit/delete forms | /reframe |
| REF-5 different micro-action | `regenerateReframe` → "Another angle" | /reframe |
| REF-6 / R7 distress path | `src/ai/safety.ts` before the model; `safetyResponse`; `acceptMicroAction` refuses safety dumps | /reframe; no plan step is offered |
| Micro-action completion pays XP | `toggleTask` pays `micro_action` once when `parent_task_id` or `brain_dump_id` is set; `hasMicroActionEvent` guard | tick the step on the plan |
| AI shrinkage, presets as fallback | `src/ai/shrink.ts`, `aiShrinkTask`; presets moved into a details fallback | Today → Drifted → "Ask for a smaller step" |
| ARCH-2 graceful degradation | `fallbackPlan`, `fallbackReframe`, `fallbackOrder`, `fallbackShrink`, notices | every AI path, with Ollama stopped |
| ARCH-3 validated, retried, rejected | `validate.ts` shapes; one JSON retry in `ollamaChat`; rejection → fallback | every AI path |
| Prompts in separate files | `prompts/planner.md`, `reframe.md`, `shrink.md`, `replan.md` | read at runtime from `process.cwd()` |
| Brain dumps stored locally | migration `003_phase3.sql`; `004_phase3_reframe_task.sql` for the source task | /reframe history |
| Local AI on/off (PDD §8.6) | `settings.ai_enabled`, `updateAiSettings`, guards in every AI action, hidden AI controls | /settings → Local AI |
| No outbound calls | loopback check, no other runtime fetch, Next telemetry disabled | static review |
| Malformed output never saved | validation runs before `createProposal` / `createBrainDump`; review edits are clamped | every AI path |
| Distress test inputs trigger safety | `detectDistress` unit tests include explicit phrases and ordinary stress | /reframe |

Open: the benchmark has not been run, the prompt voice has not had a separate
voice-writer pass, and no acceptance step has been exercised against a live
model or browser yet.
