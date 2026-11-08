// "Today" is this machine's local calendar date. Phase 1 has no server, cloud or
// timezone setting, so the laptop's clock decides which day a task belongs to.
export function localDateString(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
