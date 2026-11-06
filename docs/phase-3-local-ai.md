# Phase 3: Local AI Integration

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
