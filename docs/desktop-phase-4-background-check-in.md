# Desktop phase 4 — the background check-in

Status: **implemented**. The four questions at the end were answered as
recommended (resident Electron, task-named reminder with tray snooze, autostart
on in packaged builds, two minutes of grace), and `docs/decisions.md` records
the result.

One change from this plan as written: `src/db/pulse-tick.ts` was not needed.
`reconcileCheckins` already does the work, so the tick is a thin bridge in
`desktop/reminder-db.js` that calls it.

## Goal

A check-in should reach the user when the window is closed: one quiet reminder
from the schedule the app already owns, answering the same `on_track` / `pivot` /
`drifted` question, without a browser tab left open and without the server
running in the background all day.

## What phase 3 measured, because it changes the plan

| State | Working set | Private |
| --- | --- | --- |
| Hidden, server stopped (main + gpu + utility) | 255–319 MB | 117–219 MB |
| Of which `gpu-process` | 100–159 MB | 31–135 MB |

Phase 0's 59 MB was an Electron process that had **never created a window**, so
it had no GPU or utility process. Once a window has existed, Chromium keeps them
for the life of the app. "Under 60 MB while closed" is not reachable by
hide-to-tray, and `--disable-gpu` only moves private memory (219 → 117 MB).

So the idle cost is not a detail to tune later: it decides the architecture.

## The architecture question

### Option A — keep Electron resident

The tray, the reminder timer and the notification all live in the process that
already exists.

- **Works while the window is closed:** everything the product needs. Reminders,
  snooze, click-to-open, and — because the reminder loop talks to SQLite, not to
  the server — no second process has to be up.
- **Costs:** ~255 MB permanently, plus ~80–100 MB only while the window is open.
  No new process, no new toolchain, no new installer work.
- **Touches:** `desktop/main.js` (loop lifecycle) and three small new modules. The
  constraint I expected — that the main process cannot load the app's TypeScript —
  does not exist: Electron 45's Node 24.22 strips types on `require`, so main
  reads `src/game/pulses.ts` and `src/db/*.ts` directly (verified this turn against
  a migrated database: settings, `createPulse`, `pendingPulse`, `dueSlots` and
  `reconcile` all ran inside `ELECTRON_RUN_AS_NODE`). No transpile step, no
  duplicated rules.
- **Disappears:** nothing. Phases 1–3 stay as they are, and the grace timer keeps
  its current meaning.

### Option B — a small non-Electron agent that owns the tray and reminders

A separate background process, Electron launched only when the window opens.

- **Works while the window is closed:** reminders, if the agent can show a
  notification. **The tray is the problem:** Node has no tray API, and Windows
  toasts from a bare Node process need a native shim and an AppUserModelID. A
  real agent is therefore a second binary in a different toolchain (Rust/Go
  ~5–10 MB) or a headless Chromium process, which is the same 150 MB again.
- **Costs:** a new toolchain in the repo, a second binary in the Phase 5
  installer, an IPC contract (port, token, who owns single-instance), and
  duplicated tray behaviour to keep the two in step.
- **Touches:** `desktop/tray.js` and `desktop/tray-menu.js` are rewritten outside
  Electron, `main.js` loses window-close ownership, autostart registers the
  agent, and the Phase 5 uninstaller has two things to remove.
- **Disappears:** the hide-to-tray and grace code as written — replaced by agent
  equivalents.

Honest reading: B is the only option that actually delivers the small idle
footprint the product wants, and it is a phase of its own, not a step inside a
reminder phase. Doing it now means doing the reminder feature and a tray rewrite
at the same time, before the installer exists.

### Option C — accept today's behaviour

Reminders only while the window is open (the renderer already notifies, per
`check-in.tsx`). The feature is then "works if you left the app open", which is
what the browser version already does.

- **Costs:** nothing. **Disappears:** the reason to have a desktop app at all.

### Pick: A, with the server staying down while hidden

Reasoning: the tray is already Electron and the only non-Electron alternative is
a native binary this project has no toolchain for; the reminder itself needs a
database read and one insert, not a server. So the loop runs in the main process,
the server keeps its phase-3 behaviour (stops two minutes after the window
closes), and a hidden app is ~255 MB rather than ~255 MB + ~100 MB.

That leaves the footprint at ~255 MB — an honest regression against the original
plan, recorded in `docs/decisions.md`, with B named as the follow-up that would
fix it. Q1 decides whether that trade stands.

## What actually drives a reminder

Nothing new is scheduled from scratch: phase 2 already owns the schedule.

| Input | Source |
| --- | --- |
| Interval, quiet hours, interruption level | `settings` (`checkin_interval_minutes`, `quiet_start/end`, `interruption_level`) |
| Whether the day is running | `day.plan_status = 'active'` and `day.confirmed_at` |
| Pauses that stop the clock | `pause` windows |
| Slots and misses | `dueSlots()` + `reconcile()` in `src/game/pulses.ts`, `CONFIG.pulses.graceMinutes` |
| Which prompt to show | newest `pending` pulse for the day |

A tick every minute: read settings and the active day, compute slots, reconcile,
insert the rows that are missing (`INSERT … ON CONFLICT DO NOTHING` — the unique
index on `(day_id, due_at)` makes a double tick harmless), then notify **only**
when the newest slot is pending, unquiet, and not already notified.

**Reading phase 1's database next to a running server:** WAL is already on and
`busy_timeout = 5000` is already set in `src/db/database.ts`; the tick opens its
own connection, does one short synchronous transaction and closes it, and retries
once on `SQLITE_BUSY`. Nothing is held open, so the server's own reconcile and a
hidden-app tick cannot deadlock, and the conflict clause means whichever runs
second changes nothing.

## Notification content and interaction

- **Says:** the product's own words, e.g. title `Check-in`, body `How is it going?`
  plus the current task title when one is open. All strings in `COPY`.
- **Click:** opens the window (starting the server if the grace already expired)
  on the check-in card. No focus stealing when the app is already visible.
- **Dismiss:** the Windows toast dismisses; the pulse stays pending in the app.
- **Snooze:** not a toast button — Electron exposes notification actions on macOS
  only. Two candidates, Q2 decides: a tray item (`Snooze for an hour`, becoming
  `Resume reminders`) or in-app only, as today.
- **Interruption level:** `gentle` never notifies (card only, as now); `standard`
  notifies once per slot; `firm` repeats at most `CONFIG.reminders.maxRepeats`
  times until answered. Quiet hours suppress all of it, and a quiet slot is
  still recorded with `quiet = 1` as today.

## Autostart

Once something runs in the background, "start with Windows" stops being a switch
with nothing behind it: without it, reminders only exist for users who launch the
app. `app.setLoginItemSettings` needs no dependency, but it must be skipped in
development (it would register `electron.exe`) and only offered from the packaged
build. Q3 decides the default.

## The two-minute grace

The grace can stay exactly as it is: reminders no longer need the server, so
stopping it does not cost the user anything except ~0.6 s of cold start when they
open the window from a notification after two minutes. Q4 decides whether to keep
2 minutes, extend it, or keep the server up for as long as the tray is.

## Files

| File | Change |
| --- | --- |
| `src/reminders/decide.ts` | New. Pure: given settings, day state, `now` and the already-notified slot, return `{ action: "none" \| "notify" \| "repeat", body, quiet }`. No DB, no Electron, no clock of its own. |
| `src/reminders/decide.test.ts` | New. The cases below, as unit tests in the root suite. |
| `src/db/pulse-tick.ts` | New. `runPulseTick(db, now)`: reconcile the active day and return the newest pending pulse. Reuses `game/pulses.ts` and `db/pulses.ts`; no new SQL beyond the existing inserts. |
| `src/db/pulse-tick.test.ts` | New. Idempotence, paused day, no active day, catch-up cap, quiet rows. |
| `src/config.ts` | Add `CONFIG.reminders` (`tickMinutes: 1`, `snoozeMinutes: 60`, `repeatMinutes: 5`, `maxRepeats: 3`). |
| `src/copy.ts` | Add the notification strings. |
| `desktop/reminder-db.js` | New. The single bridge between Electron and `src/**.ts`: opens the database for one tick through `openDatabase()` (WAL and `busy_timeout` already applied there), runs the tick, closes the connection. |
| `desktop/reminder-timer.js` | New. Interval wrapper with injected clock: start/stop, one tick at a time, errors logged and swallowed so a bad tick cannot kill the shell. |
| `desktop/notify.js` | New. Electron `Notification` glue: show, click → `onOpen`, repeat bookkeeping by slot key. |
| `desktop/main.js` | Start the loop on ready and stop it in `before-quit`; on each tick, run the tick against the DB only when the server is not already doing it, and notify per `decide`. |
| `desktop/tray-menu.js` | Only if Q2 picks tray snooze: a third item that toggles between snooze and resume. |
| `desktop/test/reminder-timer.test.js` | New. Starts, stops, never overlaps ticks, survives a throwing tick. |
| `docs/decisions.md` | ADR entry: the architecture choice, the footprint it accepts, and the Q answers. |
| `README.md` | Desktop section: what a reminder does while the window is closed. |

## Behaviour, case by case

1. Window closed, grace expired, server down, slot due → row inserted, one notification, server still down.
2. Window open, server up → the server's own reconcile wins; the tick's insert conflicts; exactly one notification for the slot.
3. Quiet hours → row inserted with `quiet = 1`, no notification, no escalation.
4. `gentle` → row inserted, no notification.
5. Paused day, or no `active` day → no slots, no rows, no notification.
6. Laptop asleep for eight hours → slots capped by `maxCatchUp`, old ones `missed`, at most one notification for the newest pending slot.
7. Notification clicked → window opens (starting the server if needed) on the check-in card; the pulse is still pending.
8. Snoozed (if Q2 picks it) → no notifications until the snooze ends; pulses still recorded.
9. Quit → the loop stops with the tray, and no timer survives.
10. Two launches → the existing single-instance lock means one loop.

## Verification

- Unit: `src/reminders/decide.test.ts` and `src/db/pulse-tick.test.ts` cover cases 1–6, 8.
- Desktop: `desktop/test/reminder-timer.test.js` covers 9 and the overlap guard.
- `npm test` (root, currently 165) and `npm run test:desktop` (currently 15) both green.
- `npm run build`.
- Loading the app's own modules through Electron's type stripping is proven for
  settings, pulses, slots and reconcile, but it is not covered by `npm test`
  (plain Node 24 cannot require `.ts`). It stays a live check, and `main.js` logs
  the tick's first result so a future Electron that drops stripping fails loudly
  instead of silently.
- Live, with a temporary data root seeded from the repo DB and
  `NIYAM_REMINDER_TICK_MS` shortened: window closed and grace expired → notification
  logged, `pulse` row present, no listener on the app port; then the same slot with
  the window open → still one row and one notification; quiet hours → no
  notification; click handler driven through the inspector on the real
  `Notification` object (a toast cannot be clicked from a script); RSS unchanged
  apart from the server while the window is open.

## Expected commits

1. `feat(reminders): decide when a check-in is worth a notification` — `decide.ts`, its tests, config, copy.
2. `feat(db): reconcile check-ins from a plain tick` — `pulse-tick.ts`, its tests.
3. `feat(desktop): remind from the tray while the window is closed` — `reminder-db.js`, timer, notify, `main.js`, tray item if chosen.
4. `docs: record the background check-in` — decisions, README.

## Blocked on the user

Everything above assumes Q1 = A. Q2 changes the tray and the interaction section,
Q3 changes autostart only, Q4 changes timing only. If Q1 = B, this document is
superseded: the tray rewrite becomes the phase, and the reminder work moves into
the agent.

## Questions

- **Q1** Architecture: resident Electron (A), small background agent (B), or accept today (C).
- **Q2** What a check-in says and how often it fires, and whether snooze is a tray item.
- **Q3** Whether "start with Windows" defaults on once reminders run in the background.
- **Q4** Whether the two-minute grace stays.
