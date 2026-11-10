import type { DatabaseSync } from "node:sqlite";
import { addPlanItem } from "./plan.ts";
import { createTask } from "./tasks.ts";

// The planner proposes and the user confirms (ARCH-4, PLAN-3). A proposal and
// its items are kept after the decision so the app can say what happened; only
// the tasks the user actually accepted are created.

export type PlanProposal = {
  id: number;
  day_id: number;
  source_text: string;
  model: string | null;
  fallback: number;
  status: "proposed" | "accepted" | "discarded";
  created_at: string;
  decided_at: string | null;
};

export type PlanProposalItem = {
  id: number;
  proposal_id: number;
  position: number;
  title: string;
  estimated_minutes: number | null;
  cognitive_load: "light" | "medium" | "heavy";
  included: number;
};

export type ProposalItemInput = {
  title: string;
  minutes: number;
  load: "light" | "medium" | "heavy";
};

export type ProposalEdit = {
  itemId: number;
  include: boolean;
  title: string;
  minutes: number;
  load: "light" | "medium" | "heavy";
};

const COLUMNS =
  "id, day_id, source_text, model, fallback, status, created_at, decided_at";
const ITEM_COLUMNS =
  "id, proposal_id, position, title, estimated_minutes, cognitive_load, included";

export function createProposal(
  db: DatabaseSync,
  input: {
    dayId: number;
    sourceText: string;
    model: string | null;
    fallback: boolean;
    items: ProposalItemInput[];
  },
): PlanProposal {
  if (input.items.length === 0) {
    throw new Error("A proposal needs at least one task.");
  }

  db.exec("BEGIN");
  try {
    const result = db
      .prepare(
        `INSERT INTO plan_proposal (day_id, source_text, model, fallback)
         VALUES (?, ?, ?, ?)`,
      )
      .run(input.dayId, input.sourceText, input.model, input.fallback ? 1 : 0);
    const proposalId = Number(result.lastInsertRowid);
    const insert = db.prepare(
      `INSERT INTO plan_proposal_item
         (proposal_id, position, title, estimated_minutes, cognitive_load)
       VALUES (?, ?, ?, ?, ?)`,
    );
    input.items.forEach((item, index) => {
      insert.run(proposalId, index + 1, item.title, item.minutes, item.load);
    });
    db.exec("COMMIT");

    const created = getProposal(db, proposalId);
    if (!created) {
      throw new Error("The proposal was inserted but could not be read back.");
    }
    return created;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function getProposal(db: DatabaseSync, id: number): PlanProposal | undefined {
  return db.prepare(`SELECT ${COLUMNS} FROM plan_proposal WHERE id = ?`).get(id) as
    | unknown as PlanProposal
    | undefined;
}

export function proposalItems(db: DatabaseSync, proposalId: number): PlanProposalItem[] {
  return db
    .prepare(
      `SELECT ${ITEM_COLUMNS} FROM plan_proposal_item
       WHERE proposal_id = ? ORDER BY position, id`,
    )
    .all(proposalId) as unknown as PlanProposalItem[];
}

/** The one proposal waiting for review on this day, newest first. */
export function latestProposedProposal(
  db: DatabaseSync,
  dayId: number,
): PlanProposal | undefined {
  return db
    .prepare(
      `SELECT ${COLUMNS} FROM plan_proposal
       WHERE day_id = ? AND status = 'proposed' ORDER BY id DESC LIMIT 1`,
    )
    .get(dayId) as unknown as PlanProposal | undefined;
}

/**
 * Creates tasks for the included, non-empty items, in proposal order, then
 * records the decision. Calling it twice adds nothing, because only a
 * `proposed` row is accepted.
 */
export function acceptProposal(
  db: DatabaseSync,
  proposalId: number,
  edits: ProposalEdit[],
): { added: number } {
  const proposal = getProposal(db, proposalId);
  if (!proposal || proposal.status !== "proposed") {
    return { added: 0 };
  }
  const items = proposalItems(db, proposalId);
  const byId = new Map(edits.map((edit) => [edit.itemId, edit]));

  let added = 0;
  db.exec("BEGIN");
  try {
    for (const item of items) {
      const edit = byId.get(item.id);
      const title = (edit?.title ?? item.title).trim().slice(0, 200);
      const include = edit ? edit.include : true;
      if (!include || !title) {
        db.prepare("UPDATE plan_proposal_item SET included = 0 WHERE id = ?").run(item.id);
        continue;
      }
      const rawMinutes = edit?.minutes ?? item.estimated_minutes ?? 15;
      const minutes = Number.isFinite(rawMinutes)
        ? Math.min(180, Math.max(5, Math.round(rawMinutes)))
        : 15;
      const load = edit?.load ?? item.cognitive_load;

      const task = createTask(db, {
        dayId: proposal.day_id,
        title,
        estimatedMinutes: minutes,
        cognitiveLoad: load,
      });
      addPlanItem(db, proposal.day_id, task.id);
      db.prepare(
        `UPDATE plan_proposal_item SET title = ?, estimated_minutes = ?, cognitive_load = ?, included = 1
         WHERE id = ?`,
      ).run(title, minutes, load, item.id);
      added += 1;
    }

    db.prepare(
      "UPDATE plan_proposal SET status = 'accepted', decided_at = datetime('now') WHERE id = ?",
    ).run(proposalId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { added };
}

export function discardProposal(db: DatabaseSync, proposalId: number): void {
  db.prepare(
    `UPDATE plan_proposal SET status = 'discarded', decided_at = datetime('now')
     WHERE id = ? AND status = 'proposed'`,
  ).run(proposalId);
}
