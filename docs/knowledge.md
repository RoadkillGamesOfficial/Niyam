# Project Knowledge: Local-First Discipline & Momentum Companion

Working product name: Niyam (display name only; see `docs/decisions.md`).

## What this is

A personal productivity companion for ONE user, running entirely on one laptop. It helps the user plan their day, stay on track with frequent light check-ins, recover from low-motivation moments, and build discipline through a game-like reward system. The goal is that being productive feels like a game worth playing, not a standard to fail against.

## Current phase

**Phase 1: Local Foundation.** Complete and reviewed.
**Phase 2: Game Loop.** Complete (2026-11-08): manual plan with profiles, check-ins, XP/combo/levels/integrity, habits, settings and day close, run end to end, reviewed and voice-passed.
**Phase 3: Local AI.** Implemented 2026-11-09, pending live testing: Ollama planner with review, Reframe brain dumps with history and safety path, AI task shrinkage, validation and fallbacks, and an AI on/off switch. The model has not been run yet. The UI uses the warm Stardew-inspired look specified in `docs/design.md` (implemented 2026-11-08).
**Phase 4: Telemetry and Calibration.** Implemented 2026-11-10, pending live testing: `/insights` with a drift heat map, completion by profile, weekly trends, habit insights, peak-window planning with a settings switch, daily/weekly observations, and a separate seed database for review.
(Decisions settled 2026-11-05: `node:sqlite`, `node:test`, plain CSS. See `docs/decisions.md`.)
Exit criteria: a task entered in the UI appears in the local database file and displays back correctly.

Phases 1–4 are built. Do NOT build post-v1 features (screen time import, desktop wrapper, cloud sync or sharing) unless explicitly asked. The completed phases were:
2. Game Loop (30-minute check-ins, XP ledger, combo, levels, integrity meter, basic habits)
3. Local AI (Ollama: task parsing, brain dump reframing, task shrinkage)
4. Telemetry (insights, drift patterns, planner calibration)

## Core concepts (know these, details are in docs/PDD.md)

- **Daily Planner:** turns messy task text into a flexible plan. Daily Profiles: Sprinting, Maintenance, Low-Energy Rescue.
- **Check-In Pulse:** every ~30 minutes. Responses: On Track, Pivot, Drifted.
- **Reframe:** an always-available brain dump that returns a diagnosis and ONE micro-action.
- **Gamification:** XP, combo multiplier, Task Shrinkage, System Integrity meter. This is a core principle, not an add-on.
- **Habits:** recurring tasks with configurable frequency, auto-added to the daily plan.

## Product principles (these override convenience)

1. Never shame. Failure states always include a next step.
2. One-click friction for anything repeated.
3. Adapt the plan, not the person.
4. Reward behavior, not volume. Honest reporting is always at least partly rewarded.
5. XP and level can NEVER decrease. Missing or drifting only resets the combo multiplier.
6. Intensity is adjustable (check-in frequency and interruption level are user settings).
7. Local and transparent: the user can see, edit, export, and delete all data.

## Tech stack and architecture rules

- Next.js + React (TypeScript) for UI and server. SQLite as a single local file. Ollama for local AI in Phase 3.
- **No outbound network calls at runtime. No cloud services. No accounts. No telemetry.**
- XP is stored as a ledger of events. Player state (level, total XP, multiplier) is derived from it.
- Raw history (tasks, pulses, brain dumps) is never overwritten or silently deleted. Later phases depend on it.
- Game rules and tunable values live in configuration, not hard-coded in logic.
- AI features (Phase 3) must degrade gracefully, and AI output must be validated before use. The AI proposes, the user approves.

## How to work in this repo

- Work in small steps. Finish one thing, show it working, then continue.
- Stay inside the current phase's scope. If something outside scope seems needed, say so and ask first.
- Ask before adding any new dependency.
- Prefer simple, readable code over clever code. The owner is learning and wants to understand what is being built.
- Write tests for game logic and data handling.
- Before ending a session, update `docs/handoff.md` with what was done, what is unfinished, and any open questions. Record settled decisions in `docs/decisions.md`.
- When unsure about product behavior, check `docs/PDD.md` first, then ask. Do not guess.

## Tone and voice (applies to all user-facing text)

Direct, warm, lightly playful. Practical coach, never a scold, never clinical. Short plain sentences. No guilt language ("you failed", "you should have"). Errors and empty states always suggest a next step. The visual style is warm and cozy, Stardew Valley-inspired: parchment and wood, rounded controls, gentle motion, gold for rewards. It is deliberately not pixel art. Tokens and component rules live in `docs/design.md`.

## Where things live

- `docs/PDD.md`: full product design document (reference, pull sections as needed, do not load all of it every time)
- `docs/design.md`: visual language, design tokens and component rules for the warm Stardew-inspired look
- `docs/roles/`: role files, one per working role (builder, reviewer, voice writer). Used when a session opens with "Read @docs/roles/<role>.md".
- `docs/handoff.md`: current state between sessions
- `docs/decisions.md`: running log of settled decisions

If any of these files do not exist yet, mention it and continue; do not invent their contents.
