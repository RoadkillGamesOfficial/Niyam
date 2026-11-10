import { CONFIG } from "../config.ts";

// Pure Phase 4 rules: no database, no clock, no React. The data layer supplies
// counted rows and the page supplies copy, which keeps the thresholds testable.

export type InsightLoad = "light" | "medium" | "heavy";

export type HourPoints = { hour: number; samples: number; points: number };

export type PeakWindow = {
  startHour: number; // inclusive, 0-23
  endHour: number; // exclusive, 1-24
  score: number; // 0..1
  samples: number;
};

/** Darker squares mean more drift, not "worse" in any moral sense. */
export function driftLevel(drifts: number): 0 | 1 | 2 | 3 | 4 {
  if (drifts <= 0) return 0;
  if (drifts < 2) return 1;
  if (drifts < 4) return 2;
  if (drifts < 7) return 3;
  return 4;
}

/** Consecutive on-track answers. Any pivot, drift or missed slot breaks the run. */
export function longestOnTrackRun(
  responses: Array<string | null | undefined>,
): number {
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
  return longest;
}

export function consistencyRate(
  answered: number,
  missed: number,
): number | null {
  const total = answered + missed;
  return total > 0 ? answered / total : null;
}

/**
 * Merges adjacent hours whose answered rate clears both the sample floor and
 * the rate floor, then keeps the strongest few windows. A peak window is about
 * the shape of the day, never a single good hour.
 */
export function findPeakWindows(
  hours: HourPoints[],
  options: { minSamples?: number; minRate?: number; max?: number } = {},
): PeakWindow[] {
  const minSamples = options.minSamples ?? CONFIG.insights.peakMinSamples;
  const minRate = options.minRate ?? CONFIG.insights.peakMinRate;
  const max = options.max ?? CONFIG.insights.peakMaxWindows;

  const qualifying = new Map<number, HourPoints>();
  for (const stat of hours) {
    if (stat.hour < 0 || stat.hour > 23 || stat.samples < minSamples) {
      continue;
    }
    if (stat.points / stat.samples >= minRate) {
      qualifying.set(stat.hour, stat);
    }
  }

  const windows: PeakWindow[] = [];
  let start: number | null = null;
  for (let hour = 0; hour <= 24; hour += 1) {
    const isPeak = hour < 24 && qualifying.has(hour);
    if (isPeak && start === null) {
      start = hour;
    }
    if (!isPeak && start !== null) {
      const inWindow = hours.filter(
        (stat) => stat.hour >= (start as number) && stat.hour < hour,
      );
      const samples = inWindow.reduce((sum, stat) => sum + stat.samples, 0);
      const points = inWindow.reduce((sum, stat) => sum + stat.points, 0);
      if (samples > 0) {
        windows.push({
          startHour: start,
          endHour: hour,
          score: points / samples,
          samples,
        });
      }
      start = null;
    }
  }

  return windows
    .sort((a, b) => b.score - a.score || a.startHour - b.startHour)
    .slice(0, max)
    .sort((a, b) => a.startHour - b.startHour);
}

export function clockFromMinutes(minutes: number): string {
  const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const mins = wrapped % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function minutesFromClock(clock: string): number {
  const [hours, minutes] = clock.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 9 * 60;
  }
  return hours * 60 + minutes;
}

/**
 * Lays the existing order onto the clock. When peak windows exist, a heavy task
 * that would start outside one waits for the next window instead; light and
 * medium tasks keep filling the time in between. Order is preserved, so this
 * never rewrites the user's plan.
 */
export function assignPlannedStarts(
  items: Array<{ minutes?: number | null; load: InsightLoad }>,
  peaks: PeakWindow[],
  startMinutes: number,
  breakMinutes = CONFIG.insights.scheduleBreakMinutes,
): string[] {
  const windows = [...peaks].sort((a, b) => a.startHour - b.startHour);
  let cursor = startMinutes;

  return items.map((item) => {
    if (item.load === "heavy" && windows.length > 0) {
      const inside = windows.some(
        (peak) =>
          cursor >= peak.startHour * 60 && cursor < peak.endHour * 60,
      );
      if (!inside) {
        const next = windows.find((peak) => peak.startHour * 60 >= cursor);
        if (next) {
          cursor = next.startHour * 60;
        }
      }
    }

    const start = clockFromMinutes(cursor);
    cursor += Math.max(1, item.minutes ?? 15) + breakMinutes;
    return start;
  });
}
