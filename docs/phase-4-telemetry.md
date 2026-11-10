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

## Implementation (2026-11-10)

`/insights` is a server-rendered view over the local database: a drift heat map,
completion by Daily Profile, eight weekly trend rows, per-habit completion with
next steps, detected peak windows, and plain-language daily and weekly notes.
The dashboard links to it from every masthead and shows suggested start times on
the plan when peak-window planning is on.

New code: `src/game/insights.ts` (pure thresholds, peak merging, start-time
layout), `src/db/insights.ts` (SQL aggregations and summaries), `src/db/schedule.ts`
(peak-aware planned starts), `src/db/seed.ts` + `scripts/seed-insights.mjs` (demo
history), migration `005_phase4_insights.sql` (the peak switch), and
`src/app/insights/page.tsx`. `getDayById` and `NIYAM_DB` support the scheduler and
the separate demo database. The AI planner prompt receives the detected windows
through `src/ai/planner.ts`; the deterministic scheduler is what actually writes
`plan_item.planned_start`.

### Requirement map

| Requirement | Implementation | User path |
| --- | --- | --- |
| Drift heat map by hour and weekday | `getDriftHeatmap` counts drifted answers and missed slots by local `due_at` hour and `day.date` weekday | `/insights` → "When drift shows up" |
| Completion rate by Daily Profile | `getProfileCompletion` joins days to tasks and groups by profile | `/insights` → "Which energy settings work" |
| Weekly trends: consistency, combo, integrity | `getWeeklyTrends` / `getCompletedWeekSummary`; `integrityFromDays` per week | `/insights` → "Week by week" |
| Per-habit insights and suggestions | `getHabitInsights` counts completed versus skipped decisions, uses `streakFor`, and offers shrink/reschedule steps below 50% after four decisions | `/insights` → "Habits" |
| Peak-window detection | `getPeakWindows` over 56 days; on-track = 1, pivot = 0.5, missed/drifted = 0; at least 3 samples and a 60% rate, merged into contiguous hours | `/insights` → "Peak windows" |
| INS-3 planner places heavy work in peaks | `schedulePlanForPeaks` + `assignPlannedStarts` preserve plan order and move heavy starts to the next peak; called when the day starts and after plan-changing actions (add, move, accept, shrink, carry over, habit sync, re-plan). The AI planner also receives `peakGuidance` | start the day; plan rows show the suggested time |
| INS-3 user can turn peak planning off | `settings.peak_windows_enabled`, `updateInsightSettings`, Settings → Insights | `/settings` → Insights |
| Daily summary | `getDailySummary` plus observation copy | `/insights` → Today |
| End-of-day and end-of-week summaries | the day-close summary already exists; `getWeeklySummary` covers this week-to-date and `getCompletedWeekSummary` covers the last full week | `/insights`; closed-day panel |
| Seed data for testing | `seedHistory` writes closed days, tasks, pulses, XP and habit occurrences; `npm run seed` targets `data/seed.db` | `npm run seed -- --db data/seed.db --fresh`, then `NIYAM_DB=data/seed.db npm run dev` |
| INS-1 local data only | every query opens the local `node:sqlite` database; there is no fetch or network path in the insight views | static review |
| INS-2 observations, never judgments | `COPY.insights` lines report counts and next steps; no failure, score or should language | `/insights` copy |
| Views stay fast with months of data | SQL grouping in the data layer; the heat map is seven 24-cell rows, not a row per pulse; existing day/task/pulse indexes cover the joins | seeded 60-day integration test; no browser timing claimed |

Open: no browser or live model was run, so the visual layout, the end-to-end
Settings toggle, and the planner with a real model remain unverified. The
reviewer pass is also still pending.

## Handoff
Update `docs/handoff.md` and `docs/decisions.md`. Run the reviewer. Then review the post-v1 backlog in the PDD (screen time import, desktop wrapper, rewards, and others) and decide what comes next.
