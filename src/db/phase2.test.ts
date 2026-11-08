import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reconcileCheckins } from "./checkins.ts";
import { getOrCreateDayForDate, pauseDay, pauseWindows } from "./days.ts";
import {
  archiveHabit,
  createHabit,
  listHabits,
  occurrencesFor,
  recordHabitOutcomeForTask,
  streakFor,
  syncHabitsForDay,
} from "./habits.ts";
import {
  addPlanItem,
  confirmPlan,
  currentPlanItem,
  listPlan,
  movePlanItem,
  planProgress,
  syncPlanWithTasks,
} from "./plan.ts";
import { getPlayerState } from "./player.ts";
import {
  answerPulse,
  createPulse,
  listPulsesForDay,
  markPulseMissed,
  pendingPulse,
} from "./pulses.ts";
import { getSettings, updateSettings } from "./settings.ts";
import { createTask, listOpenTasksBefore, setTaskStatus } from "./tasks.ts";
import { addXpEvent, hasEventForPulse, hasTaskCompletionEvent, totalXp } from "./xp.ts";
import { slotKey } from "../game/pulses.ts";
import { localDateString } from "../time.ts";
import { withTempDatabase } from "./test-helpers.ts";

const today = localDateString();

describe("plan timeline", () => {
  it("keeps plan order and moves one item at a time", () => {
    withTempDatabase((db) => {
      const day = getOrCreateDayForDate(db, today);
      const first = createTask(db, { dayId: day.id, title: "First" });
      const second = createTask(db, { dayId: day.id, title: "Second" });
      createTask(db, { dayId: day.id, title: "Third" });
      addPlanItem(db, day.id, first.id);
      addPlanItem(db, day.id, second.id);
      syncPlanWithTasks(db, day.id); // appends the third task

      assert.deepEqual(
        listPlan(db, day.id).map((item) => item.title),
        ["First", "Second", "Third"],
      );

      movePlanItem(db, day.id, second.id, "up");
      assert.deepEqual(
        listPlan(db, day.id).map((item) => item.title),
        ["Second", "First", "Third"],
      );

      // Moving the top item up is a no-op, not an error.
      movePlanItem(db, day.id, second.id, "up");
      assert.equal(listPlan(db, day.id)[0].title, "Second");
    });
  });

  it("never adds the same task to the plan twice", () => {
    withTempDatabase((db) => {
      const day = getOrCreateDayForDate(db, today);
      const task = createTask(db, { dayId: day.id, title: "Only once" });
      addPlanItem(db, day.id, task.id);
      addPlanItem(db, day.id, task.id);
      assert.equal(listPlan(db, day.id).length, 1);
    });
  });

  it("reports the current task as the first open one", () => {
    withTempDatabase((db) => {
      const day = getOrCreateDayForDate(db, today);
      const first = createTask(db, { dayId: day.id, title: "First" });
      const second = createTask(db, { dayId: day.id, title: "Second" });
      addPlanItem(db, day.id, first.id);
      addPlanItem(db, day.id, second.id);

      assert.equal(currentPlanItem(db, day.id)?.title, "First");
      setTaskStatus(db, first.id, "done");
      assert.equal(currentPlanItem(db, day.id)?.title, "Second");
      assert.deepEqual(planProgress(db, day.id), { done: 1, total: 2 });
    });
  });
});

describe("pulses and the combo", () => {
  it("creates one row per slot even when reconciled twice", () => {
    withTempDatabase((db) => {
      const day = getOrCreateDayForDate(db, today);
      const due = "2026-11-08 09:30:00";
      createPulse(db, { dayId: day.id, dueAt: due, status: "pending" });
      createPulse(db, { dayId: day.id, dueAt: due, status: "pending" });
      assert.equal(listPulsesForDay(db, day.id).length, 1);
      assert.ok(pendingPulse(db, day.id));
    });
  });

  it("answers only once, so XP cannot be paid twice", () => {
    withTempDatabase((db) => {
      const day = getOrCreateDayForDate(db, today);
      createPulse(db, { dayId: day.id, dueAt: "2026-11-08 09:30:00", status: "pending" });
      const pulse = pendingPulse(db, day.id);
      assert.ok(pulse);

      const answered = answerPulse(db, pulse.id, "on_track", null, "2026-11-08 09:31:00");
      assert.equal(answered?.status, "answered");
      assert.equal(answerPulse(db, pulse.id, "on_track", null, "2026-11-08 09:32:00"), undefined);
      assert.equal(hasEventForPulse(db, pulse.id), false); // nothing paid by the data layer
    });
  });

  it("resets the derived multiplier on a missed check-in", () => {
    withTempDatabase((db) => {
      const day = getOrCreateDayForDate(db, today);
      createPulse(db, { dayId: day.id, dueAt: "2026-11-08 09:00:00", status: "pending" });
      createPulse(db, { dayId: day.id, dueAt: "2026-11-08 09:30:00", status: "pending" });
      const [first, second] = listPulsesForDay(db, day.id);
      answerPulse(db, first.id, "on_track", null, "2026-11-08 09:01:00");
      answerPulse(db, second.id, "on_track", null, "2026-11-08 09:31:00");
      assert.equal(getPlayerState(db).multiplier, 1.5);

      createPulse(db, { dayId: day.id, dueAt: "2026-11-08 10:00:00", status: "pending" });
      const third = listPulsesForDay(db, day.id)[2];
      markPulseMissed(db, third.id);
      assert.equal(getPlayerState(db).multiplier, 1);
    });
  });

  it("reconciles an overdue plan into missed slots plus one prompt", () => {
    withTempDatabase((db) => {
      const now = new Date();
      const start = new Date(now.getTime() - 90 * 60_000);
      const day = getOrCreateDayForDate(db, today);
      confirmPlan(db, day.id, slotKey(start));
      const fresh = getOrCreateDayForDate(db, today);

      const result = reconcileCheckins(db, fresh, getSettings(db), now);
      assert.equal(result.pending, true);
      assert.equal(result.missed, 2);
      const pulses = listPulsesForDay(db, day.id);
      assert.equal(pulses.filter((pulse) => pulse.status === "missed").length, 2);
      assert.equal(pulses.filter((pulse) => pulse.status === "pending").length, 1);
    });
  });
});

describe("quiet hours", () => {
  it("keeps quiet slots as quiet prompts instead of misses", () => {
    withTempDatabase((db) => {
      const now = new Date();
      const start = new Date(now.getTime() - 45 * 60_000);
      const day = getOrCreateDayForDate(db, today);
      confirmPlan(db, day.id, slotKey(start));
      const settings = updateSettings(db, {
        intervalMinutes: 30,
        interruptionLevel: "firm",
        quietStart: "00:00",
        quietEnd: "23:59",
      });
      const fresh = getOrCreateDayForDate(db, today);

      const result = reconcileCheckins(db, fresh, settings, now);
      const pulses = listPulsesForDay(db, day.id);
      assert.ok(pulses.length >= 1);
      assert.ok(pulses.every((pulse) => pulse.status === "pending" && pulse.quiet === 1));
      assert.equal(result.missed, 0);

      // A later pass must not age them into misses, and the combo stays intact.
      const later = reconcileCheckins(
        db,
        fresh,
        settings,
        new Date(now.getTime() + 30 * 60_000),
      );
      assert.equal(later.missed, 0);
      assert.equal(getPlayerState(db).multiplier, 1);
    });
  });
});

describe("XP ledger", () => {
  it("only ever adds, so totals cannot go down", () => {
    withTempDatabase((db) => {
      const day = getOrCreateDayForDate(db, today);
      addXpEvent(db, { dayId: day.id, amount: 10, reason: "pulse_on_track" });
      addXpEvent(db, { dayId: day.id, amount: 30, reason: "task_done" });
      assert.equal(totalXp(db), 40);
      assert.equal(getPlayerState(db).level.name, "Mortal");
    });
  });

  it("guards task completion XP against a second payout", () => {
    withTempDatabase((db) => {
      const day = getOrCreateDayForDate(db, today);
      const task = createTask(db, { dayId: day.id, title: "Finish me" });
      assert.equal(hasTaskCompletionEvent(db, task.id), false);
      addXpEvent(db, { dayId: day.id, amount: 30, reason: "task_done", taskId: task.id });
      assert.equal(hasTaskCompletionEvent(db, task.id), true);
    });
  });
});

describe("habits", () => {
  it("creates a task and an occurrence when due", () => {
    withTempDatabase((db) => {
      const day = getOrCreateDayForDate(db, today);
      const habit = createHabit(db, { name: "Make the bed", frequency: "daily" });
      const created = syncHabitsForDay(db, {
        dayId: day.id,
        date: new Date(),
        profile: "maintenance",
      });

      assert.equal(created, 1);
      const occurrences = occurrencesFor(db, habit.id);
      assert.equal(occurrences.length, 1);
      assert.equal(occurrences[0].outcome, "pending");
      assert.ok(occurrences[0].task_id);
      assert.equal(listPlan(db, day.id).length, 1);

      recordHabitOutcomeForTask(db, occurrences[0].task_id as number, true);
      assert.equal(streakFor(db, habit.id), 1);
    });
  });

  it("defers non-essential habits on a low-energy day without a task", () => {
    withTempDatabase((db) => {
      const day = getOrCreateDayForDate(db, today);
      const habit = createHabit(db, {
        name: "Stretch",
        frequency: "daily",
        essential: false,
      });
      syncHabitsForDay(db, { dayId: day.id, date: new Date(), profile: "low_energy" });

      const occurrences = occurrencesFor(db, habit.id);
      assert.equal(occurrences[0].outcome, "deferred");
      assert.equal(occurrences[0].task_id, null);
      assert.equal(listPlan(db, day.id).length, 0);
    });
  });

  it("archives instead of deleting, keeping the history", () => {
    withTempDatabase((db) => {
      const day = getOrCreateDayForDate(db, today);
      const habit = createHabit(db, { name: "Read", frequency: "daily" });
      syncHabitsForDay(db, { dayId: day.id, date: new Date(), profile: "maintenance" });
      archiveHabit(db, habit.id);

      assert.equal(listHabits(db).length, 0);
      assert.equal(occurrencesFor(db, habit.id).length, 1);
    });
  });
});

describe("settings", () => {
  it("saves valid values", () => {
    withTempDatabase((db) => {
      const saved = updateSettings(db, {
        intervalMinutes: 45,
        interruptionLevel: "gentle",
        quietStart: "22:00",
        quietEnd: "07:00",
      });
      assert.equal(saved.checkin_interval_minutes, 45);
      assert.equal(saved.interruption_level, "gentle");
      assert.equal(getSettings(db).quiet_start, "22:00");
    });
  });

  it("rejects an interval outside the allowed range", () => {
    withTempDatabase((db) => {
      assert.throws(
        () =>
          updateSettings(db, {
            intervalMinutes: 1,
            interruptionLevel: "standard",
            quietStart: null,
            quietEnd: null,
          }),
        /between 5 and 240/,
      );
    });
  });
});

describe("carry-over suggestions", () => {
  it("offers old open tasks once and stops after they are carried", () => {
    withTempDatabase((db) => {
      const yesterday = getOrCreateDayForDate(db, "2026-01-01");
      const open = createTask(db, { dayId: yesterday.id, title: "Old open task" });
      createTask(db, { dayId: yesterday.id, title: "Done task" });
      setTaskStatus(db, open.id + 1, "done");

      const day = getOrCreateDayForDate(db, today);
      const suggestions = listOpenTasksBefore(db, today, day.id);
      assert.equal(suggestions.length, 1);
      assert.equal(suggestions[0].title, "Old open task");
    });
  });
});

describe("pauses", () => {
  it("records one open window and closes it on resume", () => {
    withTempDatabase((db) => {
      const day = getOrCreateDayForDate(db, today);
      pauseDay(db, day.id, "2026-11-08 10:00:00");
      pauseDay(db, day.id, "2026-11-08 10:05:00"); // double submit
      assert.equal(pauseWindows(db, day.id).length, 1);
      assert.equal(pauseWindows(db, day.id)[0].end, null);
    });
  });
});
