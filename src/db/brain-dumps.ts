import type { DatabaseSync } from "node:sqlite";

// Brain dumps are stored locally and belong to the user (REF-4). The text is
// theirs and is never rewritten by a regeneration; only the reading is updated.
// Deleting one is an explicit action, which is why this table has no archive flag.

export type BrainDump = {
  id: number;
  day_id: number | null;
  text: string;
  category: string | null;
  diagnosis: string | null;
  micro_action: string | null;
  safety: number;
  fallback: number;
  model: string | null;
  task_id: number | null;
  source_task_id: number | null;
  created_at: string;
  updated_at: string;
};

export type NewBrainDump = {
  dayId: number | null;
  text: string;
  category: string;
  diagnosis: string;
  microAction: string;
  safety: boolean;
  fallback: boolean;
  model: string;
  sourceTaskId?: number | null;
};

export type BrainDumpReading = {
  category: string;
  diagnosis: string;
  microAction: string;
  safety: boolean;
  fallback: boolean;
  model: string;
};

const COLUMNS =
  "id, day_id, text, category, diagnosis, micro_action, safety, fallback, model, task_id, source_task_id, created_at, updated_at";

export function createBrainDump(db: DatabaseSync, input: NewBrainDump): BrainDump {
  const text = input.text.trim();
  if (!text) {
    throw new Error("A brain dump needs some text.");
  }
  const result = db
    .prepare(
      `INSERT INTO brain_dump
         (day_id, text, category, diagnosis, micro_action, safety, fallback, model, source_task_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.dayId,
      text,
      input.category,
      input.diagnosis,
      input.microAction,
      input.safety ? 1 : 0,
      input.fallback ? 1 : 0,
      input.model,
      input.sourceTaskId ?? null,
    );
  const created = getBrainDump(db, Number(result.lastInsertRowid));
  if (!created) {
    throw new Error("The brain dump was inserted but could not be read back.");
  }
  return created;
}

export function getBrainDump(db: DatabaseSync, id: number): BrainDump | undefined {
  return db.prepare(`SELECT ${COLUMNS} FROM brain_dump WHERE id = ?`).get(id) as
    | unknown as BrainDump
    | undefined;
}

/**
 * Newest first. With no limit every dump is returned, which is what the page
 * uses: REF-4 says any dump can be viewed, so older ones must stay reachable.
 */
export function listBrainDumps(db: DatabaseSync, limit?: number): BrainDump[] {
  if (typeof limit === "number") {
    return db
      .prepare(`SELECT ${COLUMNS} FROM brain_dump ORDER BY id DESC LIMIT ?`)
      .all(limit) as unknown as BrainDump[];
  }
  return db
    .prepare(`SELECT ${COLUMNS} FROM brain_dump ORDER BY id DESC`)
    .all() as unknown as BrainDump[];
}

export function updateBrainDumpReading(
  db: DatabaseSync,
  id: number,
  reading: BrainDumpReading,
): void {
  db.prepare(
    `UPDATE brain_dump SET category = ?, diagnosis = ?, micro_action = ?, safety = ?,
       fallback = ?, model = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(
    reading.category,
    reading.diagnosis,
    reading.microAction,
    reading.safety ? 1 : 0,
    reading.fallback ? 1 : 0,
    reading.model,
    id,
  );
}

export function updateBrainDumpText(db: DatabaseSync, id: number, text: string): void {
  const cleaned = text.trim();
  if (!cleaned) {
    throw new Error("A brain dump needs some text.");
  }
  db.prepare("UPDATE brain_dump SET text = ?, updated_at = datetime('now') WHERE id = ?").run(
    cleaned,
    id,
  );
}

export function setBrainDumpTask(db: DatabaseSync, id: number, taskId: number | null): void {
  db.prepare("UPDATE brain_dump SET task_id = ?, updated_at = datetime('now') WHERE id = ?").run(
    taskId,
    id,
  );
}

/**
 * Explicit delete (REF-4). Tasks created from the dump stay on the plan: the
 * history of the work matters more than the link, so the pointer is cleared
 * rather than the task being cascaded away.
 */
export function deleteBrainDump(db: DatabaseSync, id: number): void {
  db.exec("BEGIN");
  try {
    db.prepare("UPDATE task SET brain_dump_id = NULL WHERE brain_dump_id = ?").run(id);
    db.prepare("DELETE FROM brain_dump WHERE id = ?").run(id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
