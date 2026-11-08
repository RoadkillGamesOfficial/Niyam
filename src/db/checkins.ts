import type { DatabaseSync } from "node:sqlite";
import { CONFIG } from "../config.ts";
import { dueSlots, isQuiet, reconcile, slotKey } from "../game/pulses.ts";
import { isPaused, parseLocalTimestamp, pauseWindows, type Day } from "./days.ts";
import { createPulse, listPulsesForDay, markPulseMissed } from "./pulses.ts";
import { currentPlanItem } from "./plan.ts";
import type { Settings } from "./settings.ts";

// Brings the pulse table in line with the clock. Runs on every page render, so
// opening the app after a nap or a restart shows what was missed instead of
// silently skipping it (PULSE-4). It is idempotent: the unique index on
// (day_id, due_at) means a second pass creates nothing.

export type ReconcileResult = { missed: number; pending: boolean };

export function reconcileCheckins(
  db: DatabaseSync,
  day: Day,
  settings: Settings,
  now: Date = new Date(),
): ReconcileResult {
  if (day.plan_status !== "active" || !day.confirmed_at) {
    return { missed: 0, pending: false };
  }

  const start = parseLocalTimestamp(day.confirmed_at);
  const pauses = pauseWindows(db, day.id);
  const slots = dueSlots(start, now, settings.checkin_interval_minutes, pauses);
  const quiet = (at: Date): boolean => isQuiet(at, settings.quiet_start, settings.quiet_end);
  const loudSlots = slots.filter((slot) => !quiet(slot));
  const existing = listPulsesForDay(db, day.id).map((pulse) =>
    parseLocalTimestamp(pulse.due_at),
  );

  const result = reconcile(loudSlots, existing, now, {
    graceMinutes: CONFIG.pulses.graceMinutes,
    quiet: () => false, // quiet slots are handled separately
  });

  const current = currentPlanItem(db, day.id);
  for (const due of result.missed) {
    createPulse(db, {
      dayId: day.id,
      dueAt: slotKey(due),
      status: "missed",
      taskId: current?.task_id ?? null,
    });
  }
  for (const due of result.pending) {
    createPulse(db, {
      dayId: day.id,
      dueAt: slotKey(due),
      status: "pending",
      taskId: current?.task_id ?? null,
    });
  }

  // Quiet hours do not drop the slot. The newest one becomes a quiet prompt: it
  // renders as a card, never escalates, and is never aged into a missed pulse.
  const quietSlots = slots.filter(quiet);
  const newestQuiet = quietSlots[quietSlots.length - 1];
  const newestSlot = slots[slots.length - 1];
  if (newestQuiet && newestSlot && newestQuiet.getTime() === newestSlot.getTime()) {
    createPulse(db, {
      dayId: day.id,
      dueAt: slotKey(newestQuiet),
      status: "pending",
      taskId: current?.task_id ?? null,
      quiet: true,
    });
  }

  // A prompt that was shown but never answered ages out into a missed check-in,
  // unless the user deliberately paused (paused time never counts).
  if (!isPaused(db, day.id)) {
    const graceMs = CONFIG.pulses.graceMinutes * 60_000;
    for (const pulse of listPulsesForDay(db, day.id)) {
      if (
        pulse.status === "pending" &&
        pulse.quiet === 0 &&
        now.getTime() - parseLocalTimestamp(pulse.due_at).getTime() > graceMs
      ) {
        markPulseMissed(db, pulse.id);
      }
    }
  }

  const pulses = listPulsesForDay(db, day.id);
  return {
    missed: result.missed.length,
    pending: pulses.some((pulse) => pulse.status === "pending"),
  };
}
