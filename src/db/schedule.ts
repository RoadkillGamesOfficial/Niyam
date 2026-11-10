import type { DatabaseSync } from "node:sqlite";
import { CONFIG } from "../config.ts";
import { assignPlannedStarts } from "../game/insights.ts";
import { getDayById, parseLocalTimestamp } from "./days.ts";
import { getPeakWindows } from "./insights.ts";
import { listPlan } from "./plan.ts";
import { getSettings } from "./settings.ts";

// Peak-window calibration (INS-3). The plan order stays exactly as the user set
// it; only suggested start times move so heavy tasks begin inside a detected
// peak. If the setting is off, or no peak has enough history yet, planned_start
// is cleared, which is the Phase 2/3 behaviour.

export function clearPlannedStarts(db: DatabaseSync, dayId: number): void {
  db.prepare("UPDATE plan_item SET planned_start = NULL WHERE day_id = ?").run(dayId);
}

/**
 * Recomputes suggested times for an active day. Returns true when peak windows
 * were applied. Only an active day with a confirmed start time is scheduled, so
 * a draft plan is never given times before the user starts.
 */
export function schedulePlanForPeaks(db: DatabaseSync, dayId: number): boolean {
  const day = getDayById(db, dayId);
  if (!day || day.plan_status !== "active" || !day.confirmed_at) {
    return false;
  }

  const settings = getSettings(db);
  if (settings.peak_windows_enabled !== 1) {
    clearPlannedStarts(db, dayId);
    return false;
  }

  const peaks = getPeakWindows(db);
  if (peaks.length === 0) {
    clearPlannedStarts(db, dayId);
    return false;
  }

  const items = listPlan(db, dayId);
  if (items.length === 0) {
    return false;
  }

  const start = parseLocalTimestamp(day.confirmed_at);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const starts = assignPlannedStarts(
    items.map((item) => ({
      minutes: item.estimated_minutes,
      load: item.cognitive_load,
    })),
    peaks,
    startMinutes,
    CONFIG.insights.scheduleBreakMinutes,
  );

  const update = db.prepare("UPDATE plan_item SET planned_start = ? WHERE id = ?");
  items.forEach((item, index) => update.run(starts[index], item.id));
  return true;
}
