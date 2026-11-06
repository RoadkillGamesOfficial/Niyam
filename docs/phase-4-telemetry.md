# Phase 4: Telemetry and Calibration

Prerequisites: Phase 3 accepted and reviewed, plus enough logged history to make charts meaningful (generate seed data for testing). Read PDD Section 8.5.

## Goal
Turn logged history into a mirror of the user's behavior, and use it to improve scheduling.

## In scope
- **Drift heat map** by hour of day and day of week.
- **Completion rate by Daily Profile**, showing which energy settings work.
- **Weekly trends:** consistency, combo length, integrity.
- **Per-habit insights:** completion rate and streaks, with suggestions to shrink or reschedule struggling habits.
- **Peak-window detection**, and optional planner use of peak windows to place heavy tasks (INS-3). User can turn it off.
- **Daily and weekly summaries** in plain language, phrased as observations, never judgments (INS-1, INS-2).
- Voice writer pass over all insight copy.

## Out of scope
Screen time import (post-v1 backlog), any cloud or sharing features.

## Suggested order
1. Seed-data generator for testing.
2. Aggregation queries with tests.
3. Heat map and trend views.
4. Per-habit insights.
5. Peak-window detection and planner integration.
6. Summaries, then voice pass.

## Acceptance
- Insights are computed only from local data.
- Heat map and trends match hand-checked results on seed data.
- With peak windows enabled, heavy tasks are placed in detected peak windows; with it disabled, planning is unchanged.
- No insight text shames or judges the user.
- Views remain fast with several months of data.

## Handoff
Update `docs/handoff.md` and `docs/decisions.md`. Run the reviewer. Then review the post-v1 backlog in the PDD (screen time import, desktop wrapper, rewards, and others) and decide what comes next.
