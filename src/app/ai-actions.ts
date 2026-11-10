"use server";

import { redirect } from "next/navigation";
import { checkOllama } from "@/ai/ollama";
import { generatePlan } from "@/ai/planner";
import { generateReframe } from "@/ai/reframe";
import { generateReplan } from "@/ai/replan";
import { generateShrink } from "@/ai/shrink";
import { CONFIG } from "@/config";
import {
  createBrainDump,
  deleteBrainDump,
  getBrainDump,
  setBrainDumpTask,
  updateBrainDumpReading,
  updateBrainDumpText,
} from "@/db/brain-dumps";
import { getOrCreateDayForDate } from "@/db/days";
import { getDatabase } from "@/db/index";
import {
  acceptProposal,
  createProposal,
  discardProposal,
  getProposal,
  proposalItems,
  type ProposalEdit,
} from "@/db/plan-proposals";
import { addPlanItem, currentPlanItem, listPlan, reorderOpenItems } from "@/db/plan";
import { schedulePlanForPeaks } from "@/db/schedule";
import { getPeakWindows } from "@/db/insights";
import { listPulsesForDay } from "@/db/pulses";
import { getSettings, updateAiSettings } from "@/db/settings";
import { createTask, getTask } from "@/db/tasks";
import { localDateString } from "@/time";

// Phase 3 server actions. Every one is a form post that redirects, like Phase 2.
// The model is called here, on the server, so the browser never talks to Ollama
// and no key or address reaches the client.

function today() {
  const db = getDatabase();
  const date = localDateString();
  const day = getOrCreateDayForDate(db, date);
  return { db, day, date };
}

function parseLoad(value: string): "light" | "medium" | "heavy" {
  return value === "light" || value === "heavy" ? value : "medium";
}

/** A compact context string: the model sees the day, not the whole database. */
function reframeContext(
  db: ReturnType<typeof getDatabase>,
  day: ReturnType<typeof today>["day"],
  extra?: string,
): string {
  const current = currentPlanItem(db, day.id);
  const recent = listPulsesForDay(db, day.id)
    .filter((pulse) => pulse.status === "answered" && pulse.response)
    .slice(-3)
    .map((pulse) => pulse.response)
    .join(", ");
  const time = new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return [
    `Profile: ${day.profile ?? "maintenance"}.`,
    `Current task: ${current?.title ?? "none"}.`,
    recent ? `Recent check-ins: ${recent}.` : "No check-ins answered yet.",
    `Local time: ${time}.`,
    extra ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Plan text to a reviewed proposal. Nothing is created until it is accepted. */
export async function proposePlan(formData: FormData): Promise<void> {
  const text = String(formData.get("source") ?? "").trim();
  if (!text || text.length > CONFIG.ai.maxInputChars) {
    redirect("/?shapeError=1");
  }

  const { db, day } = today();
  if (day.plan_status === "closed") {
    redirect("/");
  }
  const settings = getSettings(db);
  if (settings.ai_enabled !== 1) {
    redirect("/?aiOff=1");
  }

  const peaks =
    settings.peak_windows_enabled === 1 ? getPeakWindows(db) : [];
  const result = await generatePlan(
    { text, profile: day.profile ?? "maintenance", peaks },
    { model: settings.ai_model },
  );

  let proposalId = 0;
  try {
    proposalId = createProposal(db, {
      dayId: day.id,
      sourceText: text,
      model: settings.ai_model,
      fallback: result.fallback,
      items: result.items,
    }).id;
  } catch {
    redirect("/?shapeError=1");
  }
  redirect(`/?proposal=${proposalId}`);
}

export async function acceptPlanProposal(formData: FormData): Promise<void> {
  const proposalId = Number(formData.get("proposalId"));
  if (!Number.isInteger(proposalId)) {
    redirect("/");
  }
  const db = getDatabase();
  const proposal = getProposal(db, proposalId);
  if (!proposal || proposal.status !== "proposed") {
    redirect("/");
  }
  const day = getOrCreateDayForDate(db, localDateString());
  if (day.id !== proposal.day_id || day.plan_status === "closed") {
    redirect("/");
  }

  const edits: ProposalEdit[] = proposalItems(db, proposalId).map((item) => ({
    itemId: item.id,
    include: formData.get(`include-${item.id}`) === "on",
    title: String(formData.get(`title-${item.id}`) ?? item.title),
    minutes: Number(formData.get(`minutes-${item.id}`) ?? item.estimated_minutes ?? 15),
    load: parseLoad(String(formData.get(`load-${item.id}`) ?? item.cognitive_load)),
  }));
  acceptProposal(db, proposalId, edits);
  schedulePlanForPeaks(db, day.id);
  redirect("/?added=1");
}

export async function discardPlanProposal(formData: FormData): Promise<void> {
  const proposalId = Number(formData.get("proposalId"));
  if (!Number.isInteger(proposalId)) {
    redirect("/");
  }
  discardProposal(getDatabase(), proposalId);
  redirect("/");
}

/** Stores the dump and its reading. The reading is never generated client-side. */
export async function startReframe(formData: FormData): Promise<void> {
  const text = String(formData.get("text") ?? "").trim();
  if (!text || text.length > CONFIG.ai.maxDumpChars) {
    redirect("/reframe?error=1");
  }

  const { db, day } = today();
  const settings = getSettings(db);
  if (settings.ai_enabled !== 1) {
    redirect("/reframe?aiOff=1");
  }

  const taskId = Number(formData.get("taskId"));
  let sourceTaskId: number | null = null;
  if (Number.isInteger(taskId)) {
    const task = getTask(db, taskId);
    if (task && task.day_id === day.id && task.status === "open") {
      sourceTaskId = task.id;
    }
  }

  const result = await generateReframe(
    { text, context: reframeContext(db, day) },
    { model: settings.ai_model },
  );
  const dump = createBrainDump(db, {
    dayId: day.id,
    text,
    category: result.category,
    diagnosis: result.diagnosis,
    microAction: result.microAction,
    safety: result.safety,
    fallback: result.fallback,
    model: settings.ai_model,
    sourceTaskId,
  });
  redirect(`/reframe?dump=${dump.id}`);
}

async function rerunReading(dumpId: number, text: string, previousStep: string | null) {
  const { db, day } = today();
  const settings = getSettings(db);
  const result = await generateReframe(
    {
      text,
      context: reframeContext(
        db,
        day,
        previousStep ? `The user asked for a different angle. Do not repeat: ${previousStep}` : "",
      ),
    },
    { model: settings.ai_model },
  );
  updateBrainDumpReading(db, dumpId, {
    category: result.category,
    diagnosis: result.diagnosis,
    microAction: result.microAction,
    safety: result.safety,
    fallback: result.fallback,
    model: settings.ai_model,
  });
}

/** REF-5: another angle, keeping the dump text exactly as written. */
export async function regenerateReframe(formData: FormData): Promise<void> {
  const dumpId = Number(formData.get("dumpId"));
  if (!Number.isInteger(dumpId)) {
    redirect("/reframe");
  }
  const db = getDatabase();
  const dump = getBrainDump(db, dumpId);
  if (!dump) {
    redirect("/reframe");
  }
  if (getSettings(db).ai_enabled !== 1) {
    redirect(`/reframe?dump=${dumpId}&aiOff=1`);
  }
  await rerunReading(dumpId, dump.text, dump.micro_action);
  redirect(`/reframe?dump=${dumpId}&refreshed=1`);
}

/** REF-4: editing the dump re-reads the corrected text in one step. */
export async function editReframe(formData: FormData): Promise<void> {
  const dumpId = Number(formData.get("dumpId"));
  const text = String(formData.get("text") ?? "").trim();
  if (!Number.isInteger(dumpId) || !text || text.length > CONFIG.ai.maxDumpChars) {
    redirect(`/reframe${Number.isInteger(dumpId) ? `?dump=${dumpId}&error=1` : ""}`);
  }
  const db = getDatabase();
  const dump = getBrainDump(db, dumpId);
  if (!dump) {
    redirect("/reframe");
  }
  if (getSettings(db).ai_enabled !== 1) {
    redirect(`/reframe?dump=${dumpId}&aiOff=1`);
  }
  updateBrainDumpText(db, dumpId, text);
  await rerunReading(dumpId, text, null);
  redirect(`/reframe?dump=${dumpId}&refreshed=1`);
}

export async function deleteReframe(formData: FormData): Promise<void> {
  const dumpId = Number(formData.get("dumpId"));
  if (!Number.isInteger(dumpId)) {
    redirect("/reframe");
  }
  deleteBrainDump(getDatabase(), dumpId);
  redirect("/reframe?deleted=1");
}

/** Puts the one step on the plan, once, and links it back for micro-action XP. */
export async function acceptMicroAction(formData: FormData): Promise<void> {
  const dumpId = Number(formData.get("dumpId"));
  if (!Number.isInteger(dumpId)) {
    redirect("/reframe");
  }
  const db = getDatabase();
  const dump = getBrainDump(db, dumpId);
  if (!dump || dump.task_id || dump.safety === 1 || !dump.micro_action) {
    redirect(`/reframe${dump ? `?dump=${dumpId}` : ""}`);
  }

  const { day } = today();
  if (day.plan_status === "closed") {
    redirect(`/reframe?dump=${dumpId}`);
  }
  const sourceTask = dump.source_task_id ? getTask(db, dump.source_task_id) : undefined;
  const task = createTask(db, {
    dayId: day.id,
    title: dump.micro_action.slice(0, CONFIG.tasks.maxTitleLength),
    estimatedMinutes: 5,
    cognitiveLoad: "light",
    // A task-linked reading shrinks that task: the step is its child, so the
    // existing micro-action XP path applies and the parent is kept.
    parentTaskId: sourceTask && sourceTask.day_id === day.id ? sourceTask.id : null,
  });
  db.prepare("UPDATE task SET brain_dump_id = ? WHERE id = ?").run(dumpId, task.id);
  addPlanItem(db, day.id, task.id);
  setBrainDumpTask(db, dumpId, task.id);
  schedulePlanForPeaks(db, day.id);
  redirect(`/reframe?dump=${dumpId}&added=1`);
}

/** The Drifted panel's "ask for a smaller step": model first, preset if it fails. */
export async function aiShrinkTask(formData: FormData): Promise<void> {
  const taskId = Number(formData.get("taskId"));
  if (!Number.isInteger(taskId)) {
    redirect("/");
  }
  const db = getDatabase();
  const parent = getTask(db, taskId);
  if (!parent) {
    redirect("/");
  }
  const settings = getSettings(db);
  if (settings.ai_enabled !== 1) {
    redirect("/?aiOff=1");
  }

  const suggestion = await generateShrink(
    { taskTitle: parent.title, load: parent.cognitive_load },
    { model: settings.ai_model },
  );
  const tiny = createTask(db, {
    dayId: parent.day_id,
    title: suggestion.title,
    estimatedMinutes: suggestion.minutes,
    cognitiveLoad: "light",
    parentTaskId: parent.id,
  });
  addPlanItem(db, parent.day_id, tiny.id);
  schedulePlanForPeaks(db, parent.day_id);
  redirect("/?shrunk=1");
}

/**
 * PLAN-4: re-plan the rest of the day over the work that is still open. The
 * model only chooses an order; a missing model keeps the current order, so the
 * button always does something useful.
 */
export async function replanWithAi(formData: FormData): Promise<void> {
  const { db, day } = today();
  if (day.plan_status !== "active") {
    redirect("/");
  }
  const open = listPlan(db, day.id).filter((item) => item.status === "open");
  if (open.length === 0) {
    redirect("/");
  }
  const settings = getSettings(db);
  if (settings.ai_enabled !== 1) {
    reorderOpenItems(db, day.id, open.map((item) => item.task_id));
    redirect("/?replanned=1");
  }

  const note = String(formData.get("note") ?? "").trim().slice(0, 300);
  const result = await generateReplan(
    {
      items: open.map((item) => ({
        title: item.title,
        minutes: item.estimated_minutes ?? 15,
        load: item.cognitive_load,
      })),
      profile: day.profile ?? "maintenance",
      time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      note,
    },
    { model: settings.ai_model },
  );
  reorderOpenItems(
    db,
    day.id,
    result.order.map((index) => open[index].task_id),
  );
  schedulePlanForPeaks(db, day.id);
  redirect(result.fallback ? "/?replanned=1&replanFallback=1" : "/?replanned=1");
}

export async function checkLocalModel(): Promise<void> {
  const status = await checkOllama();
  redirect(`/settings?ai=${status.ok ? "ok" : "down"}`);
}

export async function saveAiSettings(formData: FormData): Promise<void> {
  const db = getDatabase();
  try {
    updateAiSettings(db, {
      enabled: formData.get("enabled") === "on",
      model: String(formData.get("model") ?? "").trim(),
    });
  } catch {
    redirect("/settings?aiError=1");
  }
  redirect("/settings?saved=1");
}
