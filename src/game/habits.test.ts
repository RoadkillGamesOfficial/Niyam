import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dateKey,
  habitStreak,
  isHabitDue,
  isHabitIncluded,
  startOfWeek,
  type Habit,
  type HabitOccurrence,
} from "./habits.ts";

const baseHabit: Habit = {
  id: 1,
  name: "Make the bed",
  frequency: "daily",
  weekdays: null,
  interval_days: null,
  times_per_week: null,
  month_day: null,
  preferred_time: "morning",
  estimated_minutes: 5,
  cognitive_load: "light",
  essential: true,
  status: "active",
};

const created = new Date(2026, 0, 1);
const on = (year: number, month: number, day: number): Date => new Date(year, month - 1, day);

describe("when a habit is due", () => {
  it("daily habits are due every day", () => {
    assert.equal(isHabitDue(baseHabit, on(2026, 3, 4), { createdOn: created, occurrences: [] }), true);
  });

  it("weekday habits only on their days", () => {
    const monday = on(2026, 11, 9); // a Monday
    assert.equal(monday.getDay(), 1);
    const habit: Habit = { ...baseHabit, frequency: "weekdays", weekdays: [1, 3, 5] };
    const occurrences: HabitOccurrence[] = [];
    assert.equal(isHabitDue(habit, monday, { createdOn: created, occurrences }), true);
    assert.equal(isHabitDue(habit, on(2026, 11, 10), { createdOn: created, occurrences }), false);
  });

  it("every-N-days habits count from creation", () => {
    const habit: Habit = { ...baseHabit, frequency: "every_n", interval_days: 3 };
    const born = on(2026, 11, 1);
    assert.equal(isHabitDue(habit, on(2026, 11, 4), { createdOn: born, occurrences: [] }), true);
    assert.equal(isHabitDue(habit, on(2026, 11, 5), { createdOn: born, occurrences: [] }), false);
    assert.equal(isHabitDue(habit, on(2026, 11, 7), { createdOn: born, occurrences: [] }), true);
  });

  it("monthly habits fall on the last day of a short month", () => {
    const habit: Habit = { ...baseHabit, frequency: "monthly", month_day: 31 };
    assert.equal(isHabitDue(habit, on(2026, 2, 28), { createdOn: created, occurrences: [] }), true);
    assert.equal(isHabitDue(habit, on(2026, 2, 27), { createdOn: created, occurrences: [] }), false);
  });

  it("flexible weekly habits stay due until completed, then wait", () => {
    const habit: Habit = { ...baseHabit, frequency: "times_per_week", times_per_week: 2 };
    const wednesday = on(2026, 11, 11);
    const monday = startOfWeek(wednesday);
    assert.equal(startOfWeek(monday).getTime(), startOfWeek(wednesday).getTime());
    assert.equal(isHabitDue(habit, wednesday, { createdOn: created, occurrences: [] }), true);

    const completed: HabitOccurrence[] = [
      { due_date: dateKey(monday), outcome: "completed" },
    ];
    assert.equal(isHabitDue(habit, wednesday, { createdOn: created, occurrences: completed }), false);
    // A new week opens the window again.
    assert.equal(isHabitDue(habit, on(2026, 11, 18), { createdOn: created, occurrences: completed }), true);
  });

  it("paused habits and dates before creation are never due", () => {
    assert.equal(
      isHabitDue({ ...baseHabit, status: "paused" }, on(2026, 3, 4), {
        createdOn: created,
        occurrences: [],
      }),
      false,
    );
    assert.equal(
      isHabitDue(baseHabit, on(2025, 12, 31), { createdOn: created, occurrences: [] }),
      false,
    );
  });
});

describe("low-energy profile filtering", () => {
  it("keeps only essential habits on a rescue day", () => {
    assert.equal(isHabitIncluded(baseHabit, "low_energy"), true);
    assert.equal(isHabitIncluded({ ...baseHabit, essential: false }, "low_energy"), false);
    assert.equal(isHabitIncluded({ ...baseHabit, essential: false }, "maintenance"), true);
  });
});

describe("habit streaks", () => {
  it("counts consecutive completions, newest first", () => {
    const occurrences: HabitOccurrence[] = [
      { due_date: "2026-11-07", outcome: "completed" },
      { due_date: "2026-11-06", outcome: "completed" },
      { due_date: "2026-11-05", outcome: "completed" },
    ];
    assert.equal(habitStreak(occurrences), 3);
  });

  it("forgives one miss per week but not two", () => {
    const oneMiss: HabitOccurrence[] = [
      { due_date: "2026-11-08", outcome: "completed" },
      { due_date: "2026-11-07", outcome: "skipped" },
      { due_date: "2026-11-06", outcome: "completed" },
    ];
    assert.equal(habitStreak(oneMiss, { gracePerWeek: 1 }), 2);

    const twoMisses: HabitOccurrence[] = [
      { due_date: "2026-11-08", outcome: "completed" },
      { due_date: "2026-11-07", outcome: "skipped" },
      { due_date: "2026-11-06", outcome: "skipped" },
      { due_date: "2026-11-05", outcome: "completed" },
    ];
    assert.equal(habitStreak(twoMisses, { gracePerWeek: 1 }), 1);
  });

  it("ignores deferred days, which are not failures", () => {
    const occurrences: HabitOccurrence[] = [
      { due_date: "2026-11-08", outcome: "completed" },
      { due_date: "2026-11-07", outcome: "deferred" },
      { due_date: "2026-11-06", outcome: "completed" },
    ];
    assert.equal(habitStreak(occurrences), 2);
  });

  it("is zero with no history", () => {
    assert.equal(habitStreak([]), 0);
  });
});
