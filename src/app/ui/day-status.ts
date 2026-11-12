import { COPY } from "@/copy";
import type { DayStatus } from "@/db/days";

export type HeaderStatus = "running" | "paused" | "closed";

/** One source for the day plaque's label and pulse colour on every screen. */
export function dayStatus(
  planStatus: DayStatus,
  paused = false,
): { label: string; state: HeaderStatus } {
  if (planStatus === "closed") {
    return { label: COPY.home.closedBadge, state: "closed" };
  }
  if (paused) {
    return { label: COPY.habits.pausedTag, state: "paused" };
  }
  if (planStatus === "active") {
    return { label: COPY.home.runningBadge, state: "running" };
  }
  return { label: COPY.home.draftBadge, state: "paused" };
}
