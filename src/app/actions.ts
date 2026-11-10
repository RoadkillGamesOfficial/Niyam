"use server";

import { redirect } from "next/navigation";
import { CONFIG } from "@/config";
import { COPY } from "@/copy";
import { reconcileCheckins } from "@/db/checkins";
import {
  getOrCreateDayForDate,
  pauseDay,
  resumeDay,
  setDayProfile,
  type DayProfile,
} from "@/db/days";
import { getDatabase } from "@/db/index";
import {
  archiveHabit,
  createHabit,
  occurrenceForTask,
  recordHabitOutcomeForTask,
  setHabitStatus,
  skipOccurrence,
  syncHabitsForDay,
  type NewHabit,
} from "@/db/habits";
import { addPlanItem, confirmPlan, listPlan, movePlanItem, syncPlanWithTasks } from "@/db/plan";
import { schedulePlanForPeaks } from "@/db/schedule";
import { answerPulse, listPulsesForDay, type PulseResponse } from "@/db/pulses";
import { getPlayerState } from "@/db/player";
import {
  getSettings,
  updateInsightSettings,
  updateSettings,
  type InterruptionLevel,
} from "@/db/settings";
import { createTask, getTask, setTaskStatus } from "@/db/tasks";
import { addXpEvent, hasEventForPulse, hasMicroActionEvent, hasTaskCompletionEvent } from "@/db/xp";
import { pulseXp, taskXp, type PulseResponse as RuleResponse } from "@/game/rules";
import { slotKey } from "@/game/pulses";
import { localDateString } from "@/time";

// Every mutation is a form post that redirects, so refresh never re-sends it.
// See docs/decisions.md ("Mutations: server actions that redirect").

function today() {
  const db = getDatabase();
  const date = localDateString();
  const day = getOrCreateDayForDate(db, date);
  return { db, day, date };
}

function stamp(): string {
  return slotKey(new Date());
}

export async function addTask(formData: FormData): Promise<void> {
  const title = String(formData.get("title") ?? "").trim();
  if (!title || title.length > CONFIG.tasks.maxTitleLength) {
    return;
  }

  const { db, day } = today();
  if (day.plan_status === "closed") {
    return; // a closed day is history; tomorrow starts fresh
  }
  const task = createTask(db, {
    dayId: day.id,
    title,
    cognitiveLoad: parseLoad(String(formData.get("cognitiveLoad") ?? "medium")),
  });
  addPlanItem(db, day.id, task.id);
  schedulePlanForPeaks(db, day.id);
  redirect("/");
}

function parseLoad(value: string): "light" | "medium" | "heavy" {
  return value === "light" || value === "heavy" ? value : "medium";
}

export async function toggleTask(formData: FormData): Promise<void> {
  const taskId = Number(formData.get("taskId"));
  if (!Number.isInteger(taskId)) {
    return;
  }

  const db = getDatabase();
  const task = getTask(db, taskId);
  if (!task) {
    return;
  }

  const done = task.status !== "done";
  setTaskStatus(db, task.id, done ? "done" : "open");
  recordHabitOutcomeForTask(db, task.id, done);

  if (done && !hasTaskCompletionEvent(db, task.id)) {
    addXpEvent(db, {
      dayId: task.day_id,
      amount: taskXp(task.cognitive_load),
      reason: "task_done",
      taskId: task.id,
    });
    // A shrunken task or an accepted reframe step is a micro-action: finishing
    // one pays honesty XP, once (a reopen/re-complete must not pay again).
    if ((task.parent_task_id || task.brain_dump_id) && !hasMicroActionEvent(db, task.id)) {
      addXpEvent(db, {
        dayId: task.day_id,
        amount: CONFIG.game.xp.microAction,
        reason: "micro_action",
        taskId: task.id,
      });
    }
  }

  redirect("/");
}

export async function setProfile(formData: FormData): Promise<void> {
  const value = String(formData.get("profile") ?? "");
  if (!["sprinting", "maintenance", "low_energy"].includes(value)) {
    return;
  }
  const { db, day } = today();
  setDayProfile(db, day.id, value as DayProfile);
  redirect("/");
}

export async function moveTask(formData: FormData): Promise<void> {
  const taskId = Number(formData.get("taskId"));
  const direction = String(formData.get("direction") ?? "");
  if (!Number.isInteger(taskId) || (direction !== "up" && direction !== "down")) {
    return;
  }
  const { db, day } = today();
  movePlanItem(db, day.id, taskId, direction);
  schedulePlanForPeaks(db, day.id);
  redirect("/");
}

/** Confirms the plan, pulls in due habits, and starts the check-in clock. */
export async function startDay(): Promise<void> {
  const { db, day, date } = today();
  if (day.plan_status !== "draft") {
    redirect("/");
  }

  syncPlanWithTasks(db, day.id);
  const settings = getSettings(db);
  syncHabitsForDay(db, {
    dayId: day.id,
    date: new Date(`${date}T12:00:00`),
    profile: (day.profile ?? "maintenance") as "sprinting" | "maintenance" | "low_energy",
  });
  confirmPlan(db, day.id, stamp());
  const refreshed = getOrCreateDayForDate(db, date);
  reconcileCheckins(db, refreshed, settings);
  schedulePlanForPeaks(db, day.id);
  redirect("/");
}

export async function pauseCheckins(): Promise<void> {
  const { db, day } = today();
  pauseDay(db, day.id, stamp());
  redirect("/");
}

export async function resumeCheckins(): Promise<void> {
  const { db, day } = today();
  resumeDay(db, day.id, stamp());
  const refreshed = getOrCreateDayForDate(db, localDateString());
  reconcileCheckins(db, refreshed, getSettings(db));
  redirect("/");
}

export async function answerCheckin(formData: FormData): Promise<void> {
  const pulseId = Number(formData.get("pulseId"));
  const response = String(formData.get("response") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (
    !Number.isInteger(pulseId) ||
    !["on_track", "pivot", "drifted"].includes(response)
  ) {
    return;
  }

  const db = getDatabase();
  const { day } = today();
  const multiplier = getPlayerState(db).multiplier;
  const answered = answerPulse(
    db,
    pulseId,
    response as PulseResponse,
    note ? note.slice(0, 280) : null,
    stamp(),
  );
  if (!answered || hasEventForPulse(db, pulseId)) {
    redirect("/");
  }

  const rulesResponse = response as RuleResponse;
  const reason =
    response === "on_track"
      ? "pulse_on_track"
      : response === "pivot"
        ? "pulse_pivot"
        : "pulse_drifted";
  addXpEvent(db, {
    dayId: day.id,
    amount: pulseXp(rulesResponse, multiplier),
    reason,
    multiplier,
    pulseId,
    taskId: answered.task_id,
  });

  redirect(response === "drifted" ? "/?shrink=1" : "/");
}

/** Turns the current task into a tiny version, keeping the original. */
export async function shrinkTask(formData: FormData): Promise<void> {
  const taskId = Number(formData.get("taskId"));
  const micro = String(formData.get("microAction") ?? "");
  const allowed = COPY.checkin.microActions as readonly string[];
  if (!Number.isInteger(taskId) || !allowed.includes(micro)) {
    return;
  }

  const db = getDatabase();
  const parent = getTask(db, taskId);
  if (!parent) {
    return;
  }

  const tiny = createTask(db, {
    dayId: parent.day_id,
    title: micro,
    estimatedMinutes: 5,
    cognitiveLoad: "light",
  });
  db.prepare("UPDATE task SET parent_task_id = ? WHERE id = ?").run(parent.id, tiny.id);
  addPlanItem(db, parent.day_id, tiny.id);
  schedulePlanForPeaks(db, parent.day_id);
  redirect("/");
}

export async function skipHabit(formData: FormData): Promise<void> {
  const occurrenceId = Number(formData.get("occurrenceId"));
  if (!Number.isInteger(occurrenceId)) {
    return;
  }
  const db = getDatabase();
  skipOccurrence(db, occurrenceId);
  redirect("/");
}

export async function addHabit(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const frequency = String(formData.get("frequency") ?? "daily");
  const detail = String(formData.get("detail") ?? "").trim();

  const input: NewHabit = {
    name,
    frequency: frequency as NewHabit["frequency"],
    essential: formData.get("essential") === "on",
    cognitiveLoad: parseLoad(String(formData.get("cognitiveLoad") ?? "light")),
  };

  if (frequency === "weekdays") {
    input.weekdays = detail
      .split(",")
      .map((part) => Number(part.trim()))
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
  } else if (frequency === "every_n") {
    input.intervalDays = Number(detail) || 1;
  } else if (frequency === "times_per_week") {
    input.timesPerWeek = Number(detail) || 1;
  } else if (frequency === "monthly") {
    input.monthDay = Number(detail) || 1;
  }

  try {
    const db = getDatabase();
    const habit = createHabit(db, input);
    // A habit added mid-day should show up today, not only tomorrow (HAB-3).
    const { day, date } = today();
    if (day.plan_status !== "closed" && habit.status === "active") {
      syncHabitsForDay(db, {
        dayId: day.id,
        date: new Date(`${date}T12:00:00`),
        profile: (day.profile ?? "maintenance") as "sprinting" | "maintenance" | "low_energy",
      });
      schedulePlanForPeaks(db, day.id);
    }
  } catch {
    redirect("/?habitError=1");
  }
  redirect("/");
}

export async function toggleHabit(formData: FormData): Promise<void> {
  const habitId = Number(formData.get("habitId"));
  const status = String(formData.get("status") ?? "");
  if (!Number.isInteger(habitId) || (status !== "active" && status !== "paused")) {
    return;
  }
  const db = getDatabase();
  setHabitStatus(db, habitId, status);
  redirect("/");
}

export async function archiveHabitAction(formData: FormData): Promise<void> {
  const habitId = Number(formData.get("habitId"));
  if (!Number.isInteger(habitId)) {
    return;
  }
  const db = getDatabase();
  archiveHabit(db, habitId);
  redirect("/");
}

export async function saveSettings(formData: FormData): Promise<void> {
  const db = getDatabase();
  const level = String(formData.get("interruptionLevel") ?? "standard");
  const quietStart = String(formData.get("quietStart") ?? "").trim();
  const quietEnd = String(formData.get("quietEnd") ?? "").trim();
  try {
    updateSettings(db, {
      intervalMinutes: Number(formData.get("intervalMinutes")),
      interruptionLevel: level as InterruptionLevel,
      quietStart: quietStart || null,
      quietEnd: quietEnd || null,
    });
  } catch {
    redirect("/settings?error=1");
  }
  redirect("/settings?saved=1");
}

export async function saveInsightSettings(formData: FormData): Promise<void> {
  const db = getDatabase();
  updateInsightSettings(db, {
    peakWindowsEnabled: formData.get("peakWindowsEnabled") === "on",
  });
  // Apply the switch at once: turning it off removes suggested times, turning it
  // on re-times the current day without waiting for the next plan edit.
  const day = getOrCreateDayForDate(db, localDateString());
  schedulePlanForPeaks(db, day.id);
  redirect("/settings?saved=1");
}

export async function closeDayAction(): Promise<void> {
  const { db, day } = today();
  if (day.plan_status !== "active") {
    redirect("/");
  }

  const pulses = listPulsesForDay(db, day.id);
  const answered = pulses.filter((pulse) => pulse.status === "answered");
  const responses = answered.map((pulse) => pulse.response);
  let longest = 0;
  let run = 0;
  for (const response of responses) {
    if (response === "on_track") {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }

  const plan = listPlan(db, day.id);
  const xpBefore = db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM xp_event WHERE day_id = ?")
    .get(day.id) as unknown as { total: number };
  const summary = {
    xp: xpBefore.total,
    answered: answered.length,
    missed: pulses.filter((pulse) => pulse.status === "missed").length,
    longestCombo: longest,
    tasksDone: plan.filter((item) => item.status === "done").length,
    tasksTotal: plan.length,
    carryOver: plan.filter((item) => item.status === "open").length,
  };

  const already = db
    .prepare("SELECT 1 AS present FROM xp_event WHERE day_id = ? AND reason = 'day_closed'")
    .get(day.id);
  if (!already) {
    addXpEvent(db, {
      dayId: day.id,
      amount: CONFIG.game.xp.dayClosed,
      reason: "day_closed",
    });
  }

  const finalSummary = {
    ...summary,
    xp: xpBefore.total + (already ? 0 : CONFIG.game.xp.dayClosed),
  };
  db.prepare(
    "UPDATE day SET plan_status = 'closed', closed_at = ?, summary = ? WHERE id = ?",
  ).run(stamp(), JSON.stringify(finalSummary), day.id);

  redirect("/");
}

/** Copies an unfinished task from a previous day into today, once. */
export async function bringOver(formData: FormData): Promise<void> {
  const taskId = Number(formData.get("taskId"));
  if (!Number.isInteger(taskId)) {
    return;
  }
  const db = getDatabase();
  const source = getTask(db, taskId);
  if (!source) {
    return;
  }
  const { day } = today();
  if (day.plan_status === "closed") {
    redirect("/");
  }
  const already = db
    .prepare("SELECT 1 AS present FROM task WHERE carried_from_day_id IS NOT NULL AND title = ? AND day_id = ?")
    .get(source.title, day.id);
  if (!already) {
    const copy = createTask(db, {
      dayId: day.id,
      title: source.title,
      cognitiveLoad: source.cognitive_load,
      estimatedMinutes: source.estimated_minutes,
    });
    db.prepare("UPDATE task SET carried_from_day_id = ? WHERE id = ?").run(
      source.day_id,
      copy.id,
    );
    addPlanItem(db, day.id, copy.id);
    schedulePlanForPeaks(db, day.id);
  }
  redirect("/");
}

/** Used by the page to make sure the check-in clock is reconciled on load. */
export async function reconcileNow(): Promise<void> {
  const db = getDatabase();
  const day = getOrCreateDayForDate(db, localDateString());
  reconcileCheckins(db, day, getSettings(db));
  redirect("/");
}

export async function markHabitDoneFromOccurrence(formData: FormData): Promise<void> {
  const taskId = Number(formData.get("taskId"));
  if (!Number.isInteger(taskId)) {
    return;
  }
  const db = getDatabase();
  const occurrence = occurrenceForTask(db, taskId);
  if (!occurrence) {
    return;
  }
  setTaskStatus(db, taskId, "done");
  recordHabitOutcomeForTask(db, taskId, true);
  redirect("/");
}
