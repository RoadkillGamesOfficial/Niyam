import { CONFIG } from "../config.ts";

// Pure scheduling logic for check-ins. The database stores slots; this module
// decides which slots should exist, which are missed, and which should wait.
// Keeping the clock out of it is what makes sleep and restart behaviour testable
// (PULSE-4).

export type PauseWindow = { start: Date; end: Date | null };

const MINUTE = 60_000;

/**
 * Wall-clock slots for one active stretch of the day.
 *
 * Pauses stop the clock rather than shifting the schedule: a 30 minute pause
 * means the next check-in is 30 minutes later in wall-clock time, and the
 * paused time itself never produces a slot (PDD §8.2, "Paused time never counts
 * against the user").
 */
export function dueSlots(
  activeSince: Date,
  now: Date,
  intervalMinutes: number,
  pauses: PauseWindow[],
): Date[] {
  const sinceMs = activeSince.getTime();
  const nowMs = now.getTime();
  if (nowMs <= sinceMs || intervalMinutes <= 0) {
    return [];
  }

  // Build the runs of clock time when the plan was actually running.
  const segments: Array<{ start: number; end: number }> = [];
  const ordered = [...pauses].sort((a, b) => a.start.getTime() - b.start.getTime());
  let cursor = sinceMs;
  for (const pause of ordered) {
    const start = Math.max(cursor, pause.start.getTime());
    const end = Math.min(nowMs, pause.end ? pause.end.getTime() : nowMs);
    if (start > cursor) {
      segments.push({ start: cursor, end: start });
    }
    cursor = Math.max(cursor, end);
  }
  if (cursor < nowMs) {
    segments.push({ start: cursor, end: nowMs });
  }

  // Walk the segments, emitting a slot every interval of *active* time.
  const slots: Date[] = [];
  let activeMs = 0;
  const intervalMs = intervalMinutes * MINUTE;
  const maxSlots = CONFIG.pulses.maxCatchUp;
  for (const segment of segments) {
    let remaining = segment.end - segment.start;
    let at = segment.start;
    while (remaining > 0 && slots.length < maxSlots) {
      const toNext = intervalMs - (activeMs % intervalMs);
      if (toNext > remaining) {
        activeMs += remaining;
        break;
      }
      at += toNext;
      activeMs += toNext;
      remaining -= toNext;
      slots.push(new Date(at));
    }
  }
  return slots;
}

/** True when the wall clock falls inside quiet hours. Handles overnight ranges. */
export function isQuiet(at: Date, start: string | null, end: string | null): boolean {
  if (!start || !end) {
    return false;
  }
  const toMinutes = (value: string): number => {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  };
  const now = at.getHours() * 60 + at.getMinutes();
  const from = toMinutes(start);
  const to = toMinutes(end);
  if (from === to) {
    return false;
  }
  return from < to ? now >= from && now < to : now >= from || now < to;
}

export type Reconciliation = {
  /** Slots that are too old to answer: log them, reset the combo, award nothing. */
  missed: Date[];
  /** The newest slot is still answerable and should be shown as a prompt. */
  pending: Date[];
};

/**
 * Decides what to do with scheduled slots that have no pulse row yet.
 *
 * Only the most recent slot can still be answered. Older slots inside the grace
 * window are left alone (they may simply not have been reconciled yet), and
 * anything older than the grace period becomes a missed check-in. Quiet hours
 * and a paused plan produce no slots at all, so they never count as missed.
 */
export function reconcile(
  slots: Date[],
  existingDue: Date[],
  now: Date,
  options: { graceMinutes: number; quiet: (at: Date) => boolean },
): Reconciliation {
  const existing = new Set(existingDue.map((date) => date.getTime()));
  const fresh = slots
    .filter((slot) => !existing.has(slot.getTime()))
    .filter((slot) => !options.quiet(slot))
    .sort((a, b) => a.getTime() - b.getTime());

  const missed: Date[] = [];
  const pending: Date[] = [];
  const newest = fresh[fresh.length - 1];
  for (const slot of fresh) {
    if (slot === newest && now.getTime() - slot.getTime() <= options.graceMinutes * MINUTE) {
      pending.push(slot);
      continue;
    }
    if (now.getTime() - slot.getTime() > options.graceMinutes * MINUTE) {
      missed.push(slot);
    }
  }
  return { missed, pending };
}

/** "HH:MM" for a slot, in local time, which is what the database stores. */
export function slotKey(at: Date): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(
    at.getHours(),
  )}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`;
}
