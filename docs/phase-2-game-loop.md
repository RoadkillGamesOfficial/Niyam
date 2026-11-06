# Phase 2: Game Loop

Prerequisites: Phase 1 accepted and reviewed. Read PDD Sections 8.1 (manual parts), 8.2, 8.4, 8.7 (basic), and Section 10.

## Goal
Make the product playable: a manual day plan, a reliable 30-minute check-in, and visible reward mechanics.

## In scope
- **Manual daily planning:** enter tasks, choose a Daily Profile (Sprinting, Maintenance, Low-Energy Rescue), reorder, confirm the plan, timeline dashboard. No AI parsing yet (PLAN-2, PLAN-3).
- **Check-in Pulse:** configurable interval (default 30 minutes), On Track / Pivot / Drifted, optional note, one-click response, Pause, missed-pulse handling, reconciliation after sleep or restart (PULSE-1 to PULSE-5).
- **Interruption levels:** Gentle, Standard, Firm. See the delivery decision below.
- **XP ledger and rules:** starting values from PDD 8.4. XP and level never decrease (GAME-1 to GAME-5). Combo multiplier (start 1.0, +0.25 per On Track, cap 3.0, resets on Drifted or missed). Levels. System Integrity meter and calendar heat map.
- **Drifted path:** honesty XP and a simple Task Shrinkage using preset (non-AI) micro-actions, as a placeholder for Phase 3.
- **Basic habits:** create habits with frequency rules, auto-add due habits to the day's plan, Essential flag, Low-Energy Rescue filtering (HAB-1 to HAB-5).
- **Day close:** summary of XP, longest combo, check-in stats, carry-over tasks.
- **Settings:** interval, interruption level, quiet hours, gamification values in configuration.
- Voice writer pass over all new copy.

## Out of scope
AI/Ollama, free-text brain dump analysis, insights views, screen time import.

## Decision required first: check-in delivery (Risk R1)
Before building the rest of the loop, prototype how a check-in reaches the user while another app (such as a game) is in focus. Test browser notifications with sound, an installable web app, and a lightweight desktop wrapper. Pick one, record it in `docs/decisions.md`, then continue. Do not skip this step.

## Suggested order
1. Delivery prototype and decision.
2. Scheduler with reconciliation, tested against sleep and restart.
3. Check-in responses and logging.
4. XP ledger, combo, levels, with unit tests for every rule.
5. Planner UI, timeline, profiles.
6. Integrity meter and heat map.
7. Habits.
8. Day close and settings.
9. Voice pass.

## Acceptance
- A full day can be run manually: plan, check-ins, XP updating visibly in real time.
- A check-in reaches the user while another app is in focus, at the chosen interruption level.
- Pulses are never lost or double-counted across sleep or restart.
- XP and level never decrease under any sequence of responses (property-style test).
- Habits appear in the plan on the correct days, and weekly habits persist until done.
- Gamification numbers are all editable in configuration.

## Handoff
Update `docs/handoff.md` and `docs/decisions.md`. Run the reviewer, then the voice writer, before Phase 3.
