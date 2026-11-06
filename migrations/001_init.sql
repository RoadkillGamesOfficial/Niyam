-- Phase 1 schema. Additive only from here: later phases add tables and columns,
-- never rewrite or delete history. See docs/handoff.md and docs/PDD.md.

-- One row per local calendar day. The PDD calls this a Day; "session" in early
-- notes means the same thing.
CREATE TABLE day (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,                          -- local date, YYYY-MM-DD
  profile TEXT,                                       -- nullable until profiles exist
  started_at TEXT NOT NULL DEFAULT (datetime('now')), -- UTC
  closed_at TEXT,
  summary TEXT
);

CREATE TABLE task (
  id INTEGER PRIMARY KEY,
  day_id INTEGER NOT NULL REFERENCES day(id),
  title TEXT NOT NULL,
  notes TEXT,
  estimated_minutes INTEGER,
  cognitive_load TEXT NOT NULL DEFAULT 'medium'
    CHECK (cognitive_load IN ('light', 'medium', 'heavy')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'done')),
  parent_task_id INTEGER REFERENCES task(id),         -- set when a task is shrunk
  created_at TEXT NOT NULL DEFAULT (datetime('now')), -- UTC
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))  -- UTC
);

-- The list page always asks for one day's tasks by status.
CREATE INDEX task_by_day_and_status ON task(day_id, status);
