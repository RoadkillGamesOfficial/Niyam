import { COPY } from "../copy.ts";

// When a due check-in is worth a notification. Pure on purpose: the shell owns
// timers and toasts, this owns the rule, so the interesting cases (quiet hours,
// gentle, already shown, firm repeats) are provable in the root test suite.

export type ReminderLevel = "gentle" | "standard" | "firm";

export type PendingCheckin = {
  dueAt: string;
  quiet: boolean;
  taskTitle: string | null;
} | null;

/** What was last shown for which slot, so a slot is never nagged twice by accident. */
export type Notified = { dueAt: string; count: number; lastAt: number } | null;

export type ReminderInput = {
  level: ReminderLevel;
  pending: PendingCheckin;
  notified: Notified;
  maxRepeats: number;
  repeatMinutes: number;
  nowMs: number;
};

export type ReminderDecision =
  | {
      action: "none";
      reason: "no-pending" | "quiet" | "gentle" | "already-notified" | "waiting";
    }
  | { action: "notify"; dueAt: string; body: string; repeat: boolean };

const TITLE_LIMIT = 80;

/** The notification's second line: the task that is open, if there is one. */
export function reminderBody(taskTitle: string | null): string {
  const title = taskTitle?.trim();
  if (!title) {
    return COPY.reminders.noTask;
  }
  const short =
    title.length > TITLE_LIMIT ? `${title.slice(0, TITLE_LIMIT - 1).trimEnd()}…` : title;
  return COPY.reminders.withTask.replace("{task}", short);
}

export function decideReminder(input: ReminderInput): ReminderDecision {
  const { level, pending, notified, maxRepeats, repeatMinutes, nowMs } = input;

  if (!pending) {
    return { action: "none", reason: "no-pending" };
  }
  // Quiet hours record the prompt but never make a sound (PDD §8.2).
  if (pending.quiet) {
    return { action: "none", reason: "quiet" };
  }
  // Gentle means the in-app card only, exactly as before Phase 4.
  if (level === "gentle") {
    return { action: "none", reason: "gentle" };
  }

  const body = reminderBody(pending.taskTitle);
  if (!notified || notified.dueAt !== pending.dueAt) {
    return { action: "notify", dueAt: pending.dueAt, body, repeat: false };
  }
  if (level !== "firm" || notified.count >= maxRepeats) {
    return { action: "none", reason: "already-notified" };
  }
  if (nowMs - notified.lastAt < repeatMinutes * 60_000) {
    return { action: "none", reason: "waiting" };
  }
  return { action: "notify", dueAt: pending.dueAt, body, repeat: true };
}
