import type { DatabaseSync } from "node:sqlite";

// Data access for the day's timeline (`plan_item`). A plan item is a task placed
// in the day; the task row keeps the work itself, so history survives reordering.
// See docs/decisions.md (plain functions that take a connection).

export type PlanItem = {
  id: number;
  day_id: number;
  task_id: number;
  position: number;
  planned_start: string | null;
  title: string;
  status: "open" | "done";
  cognitive_load: "light" | "medium" | "heavy";
  estimated_minutes: number | null;
  habit_id: number | null;
};

const COLUMNS = `
  plan_item.id, plan_item.day_id, plan_item.task_id, plan_item.position,
  plan_item.planned_start, task.title, task.status, task.cognitive_load,
  task.estimated_minutes, task.habit_id`;

export function listPlan(db: DatabaseSync, dayId: number): PlanItem[] {
  return db
    .prepare(
      `SELECT ${COLUMNS} FROM plan_item
       JOIN task ON task.id = plan_item.task_id
       WHERE plan_item.day_id = ?
       ORDER BY plan_item.position, plan_item.id`,
    )
    .all(dayId) as unknown as PlanItem[];
}

/** Appends a task to the end of the plan. Adding the same task twice is a no-op. */
export function addPlanItem(db: DatabaseSync, dayId: number, taskId: number): void {
  const row = db
    .prepare("SELECT COALESCE(MAX(position), 0) AS last FROM plan_item WHERE day_id = ?")
    .get(dayId) as unknown as { last: number };
  db.prepare(
    `INSERT INTO plan_item (day_id, task_id, position)
     VALUES (?, ?, ?)
     ON CONFLICT(task_id) DO NOTHING`,
  ).run(dayId, taskId, row.last + 1);
}

/** Every task on the day that is not on the timeline yet, appended in creation order. */
export function syncPlanWithTasks(db: DatabaseSync, dayId: number): void {
  const missing = db
    .prepare(
      `SELECT task.id FROM task
       LEFT JOIN plan_item ON plan_item.task_id = task.id
       WHERE task.day_id = ? AND plan_item.id IS NULL
       ORDER BY task.created_at, task.id`,
    )
    .all(dayId) as unknown as Array<{ id: number }>;
  for (const task of missing) {
    addPlanItem(db, dayId, task.id);
  }
}

/**
 * Moves one task up or down, then renumbers the whole plan. Renumbering keeps
 * positions dense, so later inserts cannot land between two equal numbers.
 */
export function movePlanItem(
  db: DatabaseSync,
  dayId: number,
  taskId: number,
  direction: "up" | "down",
): void {
  const items = listPlan(db, dayId);
  const index = items.findIndex((item) => item.task_id === taskId);
  if (index === -1) {
    return;
  }
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= items.length) {
    return;
  }
  const reordered = [...items];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  const update = db.prepare("UPDATE plan_item SET position = ? WHERE id = ?");
  reordered.forEach((item, position) => update.run(position + 1, item.id));
}

/** The task the user is meant to be on: first open item in plan order. */
export function currentPlanItem(
  db: DatabaseSync,
  dayId: number,
): PlanItem | undefined {
  return listPlan(db, dayId).find((item) => item.status === "open");
}

export function planProgress(
  db: DatabaseSync,
  dayId: number,
): { done: number; total: number } {
  const row = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN task.status = 'done' THEN 1 ELSE 0 END) AS done
       FROM plan_item JOIN task ON task.id = plan_item.task_id
       WHERE plan_item.day_id = ?`,
    )
    .get(dayId) as unknown as { total: number; done: number | null };
  return { done: row.done ?? 0, total: row.total };
}

/**
 * Applies an order chosen for the open work (PLAN-4). Finished work stays below
 * it in its existing order; anything the order left out keeps its relative place
 * at the end of the open block, so a short reply can never lose a task.
 */
export function reorderOpenItems(
  db: DatabaseSync,
  dayId: number,
  taskIdsInOrder: number[],
): void {
  const items = listPlan(db, dayId);
  const open = items.filter((item) => item.status === "open");
  const remaining = new Map(open.map((item) => [item.task_id, item]));
  const ordered: PlanItem[] = [];

  for (const taskId of taskIdsInOrder) {
    const item = remaining.get(taskId);
    if (item) {
      ordered.push(item);
      remaining.delete(taskId);
    }
  }
  for (const item of open) {
    if (remaining.has(item.task_id)) {
      ordered.push(item);
    }
  }

  const done = items.filter((item) => item.status === "done");
  const update = db.prepare("UPDATE plan_item SET position = ? WHERE id = ?");
  [...ordered, ...done].forEach((item, index) => update.run(index + 1, item.id));
}

/** A confirmed plan starts the check-in clock; the day row records when. */
export function confirmPlan(db: DatabaseSync, dayId: number, at: string): void {
  db.prepare(
    "UPDATE day SET plan_status = 'active', confirmed_at = ? WHERE id = ? AND plan_status = 'draft'",
  ).run(at, dayId);
}

export function closeDay(db: DatabaseSync, dayId: number, at: string, summary: string): void {
  db.prepare(
    "UPDATE day SET plan_status = 'closed', closed_at = ?, summary = ? WHERE id = ?",
  ).run(at, summary, dayId);
}
