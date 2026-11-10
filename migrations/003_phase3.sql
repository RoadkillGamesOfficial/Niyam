-- Phase 3 schema. Additive only: no Phase 1 or 2 row is rewritten.
-- See docs/phase-3-local-ai.md and PDD §8.1, 8.3, 11, 12.

-- A local model is optional, and its name is data the user can change without
-- editing code. The URL stays in src/config.ts (loopback only).
ALTER TABLE settings ADD COLUMN ai_enabled INTEGER NOT NULL DEFAULT 1
  CHECK (ai_enabled IN (0, 1));
ALTER TABLE settings ADD COLUMN ai_model TEXT NOT NULL DEFAULT 'qwen2.5:1.5b-instruct';

-- One brain dump and whatever the model made of it. The text is the user's own
-- words and is never rewritten by a regeneration; only the reading is updated.
-- Deleting a dump is an explicit user action (REF-4), which is why there is no
-- archived_at column here.
CREATE TABLE brain_dump (
  id INTEGER PRIMARY KEY,
  day_id INTEGER REFERENCES day(id),
  text TEXT NOT NULL,
  category TEXT,                                      -- clarity|overwhelm|fatigue|...
  diagnosis TEXT,
  micro_action TEXT,
  safety INTEGER NOT NULL DEFAULT 0 CHECK (safety IN (0, 1)),
  fallback INTEGER NOT NULL DEFAULT 0 CHECK (fallback IN (0, 1)),
  model TEXT,
  task_id INTEGER REFERENCES task(id),                -- the accepted micro-action
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX brain_dump_by_day ON brain_dump(day_id, id);

-- A task created from a reframe step remembers where it came from, so micro-
-- action XP can be paid once and the link survives a page reload.
ALTER TABLE task ADD COLUMN brain_dump_id INTEGER REFERENCES brain_dump(id);

-- The planner proposes; the user confirms (ARCH-4, PLAN-3). A proposal is kept
-- after it is accepted or discarded so the app can say what it did.
CREATE TABLE plan_proposal (
  id INTEGER PRIMARY KEY,
  day_id INTEGER NOT NULL REFERENCES day(id),
  source_text TEXT NOT NULL,
  model TEXT,
  fallback INTEGER NOT NULL DEFAULT 0 CHECK (fallback IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'accepted', 'discarded')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at TEXT
);
CREATE INDEX plan_proposal_by_day ON plan_proposal(day_id, status);

-- One row per proposed task. Edits made during review are stored here, so the
-- proposal still reads correctly after the tasks exist.
CREATE TABLE plan_proposal_item (
  id INTEGER PRIMARY KEY,
  proposal_id INTEGER NOT NULL REFERENCES plan_proposal(id),
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  estimated_minutes INTEGER,
  cognitive_load TEXT NOT NULL DEFAULT 'medium'
    CHECK (cognitive_load IN ('light', 'medium', 'heavy')),
  included INTEGER NOT NULL DEFAULT 1 CHECK (included IN (0, 1))
);
CREATE INDEX plan_proposal_item_by_proposal ON plan_proposal_item(proposal_id, position);
