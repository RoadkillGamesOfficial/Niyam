// Tiny, testable keyboard rules. The client component owns the DOM listener;
// this module decides whether a key should answer and which response it means.
// Keeping it pure makes the typing/modal guards testable without a browser.

export type CheckinResponse = "on_track" | "pivot" | "drifted";

export const CHECKIN_SHORTCUTS = {
  o: "on_track",
  p: "pivot",
  d: "drifted",
} as const satisfies Record<string, CheckinResponse>;

export type ShortcutTarget = {
  tagName?: string;
  isContentEditable?: boolean;
} | null;

export function isTypingTarget(target: ShortcutTarget): boolean {
  if (!target) {
    return false;
  }
  const tag = target.tagName?.toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(target.isContentEditable);
}

export function checkinShortcut(
  key: string,
  target: ShortcutTarget,
  modalOpen: boolean,
): CheckinResponse | null {
  if (modalOpen || isTypingTarget(target)) {
    return null;
  }
  const lower = key.toLowerCase();
  return lower in CHECKIN_SHORTCUTS
    ? CHECKIN_SHORTCUTS[lower as keyof typeof CHECKIN_SHORTCUTS]
    : null;
}
