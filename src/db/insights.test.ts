import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dateKey } from "../game/habits.ts";
import { assignPlannedStarts } from "../game/insights.ts";
import { getOrCreateDayForDate, type DayProfile } from "./days.ts";
import { createHabit } from "./habits.ts";
import {
  getCompletedWeekSummary,
  getDailySummary,
  getDriftHeatmap,
  getHabitInsights,
  getPeakWindows,
  getProfileCompletion,
  getWeeklySummary,
  getWeeklyTrends,
} from "./insights.ts";
import { addPlanItem, confirmPlan, listPlan } from "./plan.ts";
import { answerPulse, createPulse, listPulsesForDay, markPulseMissed } from "./pulses.ts";
import { schedulePlanForPeaks } from "./schedule.ts";
import { seedHistory } from "./seed.ts";
import { updateInsightSettings } from "./settings.ts";
import { createTask, setTaskStatus } from "./tasks.ts";
import { withTempDatabase } from "./test-helpers.ts";

const base = new Date();

function daysAgo(count: number): string {
  const date = new Date(base.getFullYear(), base.getMonth(), base.getDate() - count);
  return dateKey(date);
}

function addAnsweredPulse(
  db: ReturnType<typeof getOrCreateDayForDate> extends never ? never : any,
  dayId: number,
  date: string,
  clock: string,
  response: "on_track" | "pivot" | "drifted",
): void {
  const due = `${date} ${clock}:00`;
  createPulse(db, { dayId, dueAt: due, status: "pending" });
  const pulse = listPulsesForDay(db, dayId).find((row) => row.due_at === due);
  assert.ok(pulse);
  answerPulse(db, pulse.id, response, null, due);
}

function addMissedPulse(
  db: ReturnType<typeof getOrCreateDayForDate> extends never ? never : any,
  dayId: number,
  date: string,
  clock: string,
): void {
  const due = `${date} ${clock}:00`;
  createPulse(db, { dayId, dueAt: due, status: "pending" });
  const pulse = listPulsesForDay(db, dayId).find((row) => row.due_at === due);
  assert.ok(pulse);
  markPulseMissed(db, pulse.id);
}

function makeDay(
  db: any,
  date: string,
  profile: DayProfile,
  tasks: Array<{ done: boolean }>,
): number {
  const day = getOrCreateDayForDate(db, date);
  db.prepare("UPDATE day SET profile = ? WHERE id = ?").run(profile, day.id);
  for (const task of tasks) {
    const created = createTask(db, {
      dayId: day.id,
      title: `Task ${task.done ? "done" : "open"}`,
      cognitiveLoad: "medium",
      estimatedMinutes: 30,
    });
    addPlanItem(db, day.id, created.id);
    if (task.done) {
      setTaskStatus(db, created.id, "done");
    }
  }
  return day.id;
}

describe("drift heat map", () => {
  it("buckets answered, missed and drifted pulses by weekday and hour", () => {
    withTempDatabase((db) => {
      const date = daysAgo(2);
      const dayId = makeDay(db, date, "maintenance", [{ done: false }]);
      addAnsweredPulse(db, dayId, date, "09:00", "on_track");
      addAnsweredPulse(db, dayId, date, "15:00", "drifted");
      addMissedPulse(db, dayId, date, "16:00");

      const map = getDriftHeatmap(db, { now: base });
      assert.equal(map.cells.length, 7 * 24);
      assert.equal(map.answered, 2);
      assert.equal(map.missed, 1);
      assert.equal(map.drifts, 2);

      const weekday = new Date(`${date}T12:00:00`).getDay();
      const afternoon = map.cells.find(
        (cell) => cell.weekday === weekday && cell.hour === 15,
      );
      assert.equal(afternoon?.answered, 1);
      assert.equal(afternoon?.drifts, 1);
      assert.equal(afternoon?.level, 1);

      const missedCell = map.cells.find(
        (cell) => cell.weekday === weekday && cell.hour === 16,
      );
      assert.equal(missedCell?.missed, 1);
      assert.equal(missedCell?.drifts, 1);
    });
  });
});

describe("profile completion", () => {
  it("shows the completion rate under each energy setting", () => {
    withTempDatabase((db) => {
      makeDay(db, daysAgo(2), "sprinting", [{ done: true }, { done: false }]);
      makeDay(db, daysAgo(1), "maintenance", [{ done: true }, { done: true }]);
      makeDay(db, daysAgo(0), "low_energy", [{ done: true }]);

      const byProfile = new Map(
        getProfileCompletion(db, { now: base }).map((row) => [row.profile, row]),
      );
      assert.deepEqual(byProfile.get("sprinting"), {
        profile: "sprinting",
        days: 1,
        tasksDone: 1,
        tasksTotal: 2,
        rate: 0.5,
      });
      assert.equal(byProfile.get("maintenance")?.rate, 1);
      assert.equal(byProfile.get("low_energy")?.rate, 1);
    });
  });
});

describe("weekly trends", () => {
  it("reports consistency, longest on-track run and integrity", () => {
    withTempDatabase((db) => {
      const first = daysAgo(2);
      const second = daysAgo(1);
      const third = daysAgo(0);
      const firstDay = makeDay(db, first, "sprinting", [{ done: true }, { done: false }]);
      const secondDay = makeDay(db, second, "maintenance", [{ done: true }, { done: true }]);
      const thirdDay = makeDay(db, third, "low_energy", [{ done: true }]);

      addAnsweredPulse(db, firstDay, first, "09:00", "on_track");
      addAnsweredPulse(db, firstDay, first, "15:00", "drifted");
      addMissedPulse(db, firstDay, first, "16:00");
      addAnsweredPulse(db, secondDay, second, "09:00", "on_track");
      addAnsweredPulse(db, secondDay, second, "15:00", "drifted");
      addAnsweredPulse(db, thirdDay, third, "09:00", "pivot");

      const trends = getWeeklyTrends(db, { now: base });
      assert.equal(trends.length, 8);
      const totals = trends.reduce(
        (sum, week) => ({
          answered: sum.answered + week.answered,
          missed: sum.missed + week.missed,
          done: sum.done + week.tasksDone,
          total: sum.total + week.tasksTotal,
        }),
        { answered: 0, missed: 0, done: 0, total: 0 },
      );
      assert.deepEqual(totals, { answered: 5, missed: 1, done: 4, total: 5 });
      const weekWithMiss = trends.find((week) => week.missed === 1);
      assert.ok(weekWithMiss);
      assert.equal(weekWithMiss.consistency, weekWithMiss.answered / (weekWithMiss.answered + 1));
      assert.ok(
        trends.every(
          (week) =>
            week.integrity === null || (week.integrity >= 0.2 && week.integrity <= 1),
        ),
      );

      const summary = getWeeklySummary(db, { now: base });
      assert.ok(summary.weekStart <= third && summary.weekEnd === third);
      assert.ok(summary.answered + summary.missed >= 1);
      assert.ok(summary.bestDay);

      const completed = getCompletedWeekSummary(db, { now: base });
      assert.ok(completed.weekEnd < summary.weekStart);
    });
  });
});

describe("peak windows", () => {
  it("finds the morning window and keeps the clean hours out of it", () => {
    withTempDatabase((db) => {
      const first = daysAgo(2);
      const second = daysAgo(1);
      const third = daysAgo(0);
      const firstDay = makeDay(db, first, "maintenance", []);
      const secondDay = makeDay(db, second, "maintenance", []);
      const thirdDay = makeDay(db, third, "maintenance", []);

      for (const [dayId, date] of [
        [firstDay, first],
        [secondDay, second],
        [thirdDay, third],
      ] as const) {
        addAnsweredPulse(db, dayId, date, "09:00", "on_track");
        addAnsweredPulse(db, dayId, date, "15:00", "drifted");
      }

      const peaks = getPeakWindows(db, { now: base });
      assert.equal(peaks.length, 1);
      assert.equal(peaks[0].startHour, 9);
      assert.equal(peaks[0].endHour, 10);
      assert.ok(peaks[0].score > 0.8);
    });
  });

  it("places heavy tasks at a peak without changing the order", () => {
    const starts = assignPlannedStarts(
      [
        { minutes: 30, load: "light" },
        { minutes: 45, load: "heavy" },
        { minutes: 15, load: "light" },
      ],
      [{ startHour: 10, endHour: 12, score: 0.8, samples: 6 }],
      9 * 60,
    );
    assert.deepEqual(starts, ["09:00", "10:00", "10:50"]);

    const noPeaks = assignPlannedStarts(
      [
        { minutes: 30, load: "light" },
        { minutes: 45, load: "heavy" },
      ],
      [],
      9 * 60,
    );
    assert.deepEqual(noPeaks, ["09:00", "09:35"]);
  });
});

describe("peak scheduling", () => {
  it("writes suggested starts while enabled and clears them when switched off", () => {
    withTempDatabase((db) => {
      const date = daysAgo(0);
      const day = getOrCreateDayForDate(db, date);
      for (const count of [2, 1, 0]) {
        addAnsweredPulse(db, day.id, daysAgo(count), "09:00", "on_track");
      }

      const light = createTask(db, {
        dayId: day.id,
        title: "Light",
        estimatedMinutes: 30,
        cognitiveLoad: "light",
      });
      const heavy = createTask(db, {
        dayId: day.id,
        title: "Heavy",
        estimatedMinutes: 45,
        cognitiveLoad: "heavy",
      });
      addPlanItem(db, day.id, light.id);
      addPlanItem(db, day.id, heavy.id);
      confirmPlan(db, day.id, `${date} 08:00:00`);

      assert.equal(schedulePlanForPeaks(db, day.id), true);
      const plan = listPlan(db, day.id);
      assert.equal(plan[0].planned_start, "08:00");
      assert.equal(plan[1].planned_start, "09:00");

      updateInsightSettings(db, { peakWindowsEnabled: false });
      assert.equal(schedulePlanForPeaks(db, day.id), false);
      assert.ok(listPlan(db, day.id).every((item) => item.planned_start === null));
    });
  });
});

describe("habit insights", () => {
  it("reports decisions and suggests a smaller or moved habit when it slips", () => {
    withTempDatabase((db) => {
      const struggling = createHabit(db, {
        name: "Evening stretch",
        frequency: "daily",
        estimatedMinutes: 20,
        cognitiveLoad: "medium",
      });
      const strong = createHabit(db, {
        name: "Make the bed",
        frequency: "daily",
        estimatedMinutes: 5,
        cognitiveLoad: "light",
      });

      const insert = db.prepare(
        `INSERT INTO habit_occurrence (habit_id, due_date, outcome) VALUES (?, ?, ?)`,
      );
      for (let index = 0; index < 8; index += 1) {
        insert.run(struggling.id, daysAgo(index + 1), index < 2 ? "completed" : "skipped");
        insert.run(strong.id, daysAgo(index + 1), "completed");
      }

      const insights = getHabitInsights(db, { now: base });
      const slipping = insights.find((row) => row.habitId === struggling.id);
      const steady = insights.find((row) => row.habitId === strong.id);
      assert.equal(slipping?.decided, 8);
      assert.equal(slipping?.completed, 2);
      assert.equal(slipping?.rate, 0.25);
      assert.deepEqual(slipping?.suggestions, ["shrink", "reschedule"]);
      assert.equal(steady?.rate, 1);
      assert.deepEqual(steady?.suggestions, []);
    });
  });
});

describe("daily summary", () => {
  it("counts the day's tasks, answers and XP locally", () => {
    withTempDatabase((db) => {
      const date = daysAgo(0);
      const dayId = makeDay(db, date, "maintenance", [{ done: true }, { done: false }]);
      addAnsweredPulse(db, dayId, date, "09:00", "on_track");
      addAnsweredPulse(db, dayId, date, "09:45", "pivot");

      const summary = getDailySummary(db, dayId);
      assert.equal(summary.tasksDone, 1);
      assert.equal(summary.tasksTotal, 2);
      assert.equal(summary.answered, 2);
      assert.equal(summary.onTrack, 1);
      assert.equal(summary.pivot, 1);
      assert.equal(summary.xp, 0);
      assert.equal(summary.hasActivity, true);
    });
  });
});

describe("seed history", () => {
  it("creates months of data that every Phase 4 view can read", () => {
    withTempDatabase((db) => {
      const result = seedHistory(db, { days: 60, seed: 17 });
      assert.equal(result.days, 60);
      assert.ok(result.tasks > 150);
      assert.ok(result.pulses > 500);

      const heat = getDriftHeatmap(db);
      assert.equal(heat.hasData, true);
      assert.ok(heat.answered > 400);
      assert.ok(heat.cells.some((cell) => cell.level >= 2));

      const profiles = getProfileCompletion(db);
      assert.ok(profiles.every((profile) => profile.tasksTotal > 0));
      assert.ok(profiles.some((profile) => profile.rate !== null && profile.rate < 0.7));

      const peaks = getPeakWindows(db);
      assert.ok(peaks.length >= 1);

      const habits = getHabitInsights(db);
      assert.equal(habits.length, 3);
      assert.ok(habits.some((habit) => habit.suggestions.length > 0));

      const trends = getWeeklyTrends(db);
      assert.equal(trends.length, 8);
      assert.ok(trends.some((week) => week.answered > 0));
      assert.ok(getWeeklySummary(db).answered > 0);
    });
  });
});
