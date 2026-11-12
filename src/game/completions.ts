import { COPY } from "../copy.ts";

// Task completion is a quiet reward, not a second reminder. The caller keeps
// one set for the page session; a task is added only when a notice is actually
// returned, so reopening and completing the same task again stays silent.

export type NotificationPermissionLike = "default" | "denied" | "granted";

export type CompletionNotice = { title: string; body: string };

export function completionNotice(
  taskId: number,
  permission: NotificationPermissionLike,
  alreadyNotified: Set<number>,
): CompletionNotice | null {
  if (permission !== "granted") {
    return null;
  }
  if (alreadyNotified.has(taskId)) {
    return null;
  }
  alreadyNotified.add(taskId);
  return {
    title: COPY.task.completionTitle,
    body: COPY.task.completionBody,
  };
}
