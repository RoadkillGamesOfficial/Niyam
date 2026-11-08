-- Phase 2 schema. Additive only: Phase 1 tables keep their rows.
-- See docs/phase-2-game-loop.md and PDD §8.1, 8.2, 8.4, 8.7, 10.

-- A day now has a plan lifecycle: draft until confirmed, active once running,
-- closed when the owner reviews it.
ALTER TABLE day ADD COLUMN plan_status TEXT NOT NULL DEFAULT 'draft'
  CHECK (plan_status IN ('draft', 'active', 'closed'));
ALTER TABLE day ADD COLUMN confirmed_at TEXT;

-- Pauses stop the check-in clock. Storing windows (not a counter) keeps the
-- schedule honest when several pauses happen in one day.
CREATE TABLE pause (
  id INTEGER PRIMARY KEY,
  day_id INTEGER NOT NULL REFERENCES day(id),
  started_at TEXT NOT NULL,
  ended_at TEXT
);

-- Habits are defined once and generate tasks on the days they are due.
CREATE TABLE habit (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  frequency TEXT NOT NULL
    CHECK (frequency IN ('daily', 'weekdays', 'every_n', 'times_per_week', 'monthly')),
  weekdays TEXT,                                      -- CSV of 0-6, Sunday = 0
  interval_days INTEGER,                              -- for every_n
  times_per_week INTEGER,                             -- for times_per_week
  month_day INTEGER,                                  -- for monthly
  preferred_time TEXT,                                -- morning|afternoon|evening
  estimated_minutes INTEGER,
  cognitive_load TEXT NOT NULL DEFAULT 'light'
    CHECK (cognitive_load IN ('light', 'medium', 'heavy')),
  essential INTEGER NOT NULL DEFAULT 0 CHECK (essential IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  -- "Delete" is an archive: history must survive (HAB-7).
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per due instance of a habit. Appended, never rewritten, so editing or
-- archiving a habit cannot change what already happened.
CREATE TABLE habit_occurrence (
  id INTEGER PRIMARY KEY,
  habit_id INTEGER NOT NULL REFERENCES habit(id),
  day_id INTEGER REFERENCES day(id),
  due_date TEXT NOT NULL,
  task_id INTEGER REFERENCES task(id),
  outcome TEXT NOT NULL DEFAULT 'pending'
    CHECK (outcome IN ('pending', 'completed', 'skipped', 'deferred')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (habit_id, due_date)
);

ALTER TABLE task ADD COLUMN habit_id INTEGER REFERENCES habit(id);
ALTER TABLE task ADD COLUMN carried_from_day_id INTEGER REFERENCES day(id);

-- The timeline: which task sits where in the day's plan.
CREATE TABLE plan_item (
  id INTEGER PRIMARY KEY,
  day_id INTEGER NOT NULL REFERENCES day(id),
  task_id INTEGER NOT NULL UNIQUE REFERENCES task(id),
  position INTEGER NOT NULL,
  planned_start TEXT,                                 -- HH:MM, a suggestion only
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX plan_item_by_day ON plan_item(day_id, position);

-- One check-in. A slot exists as soon as it comes due, so a missed pulse is
-- still a row: dropping it would hide history from later phases.
CREATE TABLE pulse (
  id INTEGER PRIMARY KEY,
  day_id INTEGER NOT NULL REFERENCES day(id),
  task_id INTEGER REFERENCES task(id),
  due_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'answered', 'missed')),
  response TEXT CHECK (response IN ('on_track', 'pivot', 'drifted')),
  note TEXT,
  answered_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Reconciliation must be idempotent: one row per scheduled slot per day.
CREATE UNIQUE INDEX pulse_by_day_and_due ON pulse(day_id, due_at);

-- XP is an append-only ledger. Totals, levels and the multiplier are derived
-- from it, which is what lets the rules be retuned later (GAME-1, GAME-2).
CREATE TABLE xp_event (
  id INTEGER PRIMARY KEY,
  day_id INTEGER REFERENCES day(id),
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  multiplier REAL NOT NULL DEFAULT 1.0,
  task_id INTEGER REFERENCES task(id),
  pulse_id INTEGER REFERENCES pulse(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX xp_event_by_day ON xp_event(day_id);

-- One settings row. Gamification numbers stay in src/config.ts so they are
-- reviewed with the code, but the daily controls are editable here.
CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  checkin_interval_minutes INTEGER NOT NULL DEFAULT 30,
  interruption_level TEXT NOT NULL DEFAULT 'standard'
    CHECK (interruption_level IN ('gentle', 'standard', 'firm')),
  quiet_start TEXT,                                   -- HH:MM
  quiet_end TEXT
);
INSERT INTO settings (id) VALUES (1);
