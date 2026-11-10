import Link from "next/link";
import { COPY } from "@/copy";
import { getBrainDump, listBrainDumps } from "@/db/brain-dumps";
import { getOrCreateDayForDate } from "@/db/days";
import { getDatabase } from "@/db/index";
import { listPlan } from "@/db/plan";
import { getSettings } from "@/db/settings";
import { getTask } from "@/db/tasks";
import { localDateString } from "@/time";
import { PendingButton } from "../pending-button";
import {
  acceptMicroAction,
  deleteReframe,
  editReframe,
  regenerateReframe,
  startReframe,
} from "../ai-actions";

// The always-available brain dump (PDD §8.3). Output is always structured: a
// category, a short reading and one step. The dump text is the user's, and the
// page lets them re-read it, change it, or delete it (REF-4).

export const dynamic = "force-dynamic";

type CategoryKey = keyof typeof COPY.reframe.categories;

function categoryLabel(category: string | null): string {
  if (!category) {
    return "";
  }
  return COPY.reframe.categories[category as CategoryKey] ?? category;
}

export default async function ReframePage({
  searchParams,
}: {
  searchParams: Promise<{
    dump?: string;
    deleted?: string;
    error?: string;
    added?: string;
    refreshed?: string;
    aiOff?: string;
  }>;
}) {
  const params = await searchParams;
  const db = getDatabase();
  const settings = getSettings(db);
  const aiEnabled = settings.ai_enabled === 1;

  const dumpId = Number(params.dump);
  const dump =
    Number.isInteger(dumpId) && dumpId > 0 ? getBrainDump(db, dumpId) : undefined;
  const past = listBrainDumps(db);
  const day = getOrCreateDayForDate(db, localDateString());
  const openItems = listPlan(db, day.id).filter((item) => item.status === "open");
  const sourceTask = dump?.source_task_id ? getTask(db, dump.source_task_id) : undefined;

  return (
    <main className="shell">
      <header className="masthead">
        <div className="masthead-top">
          <h1 className="wordmark">{COPY.reframe.heading}</h1>
          <span className="header-links">
            <Link className="link" href="/">
              {COPY.nav.home}
            </Link>
            <Link className="link" href="/insights">
              {COPY.nav.insights}
            </Link>
            <Link className="link" href="/settings">
              {COPY.nav.settings}
            </Link>
          </span>
        </div>
        <p className="lede">{COPY.reframe.lede}</p>
        <p className="hint">{COPY.reframe.shortcutHint}</p>
      </header>

      {params.deleted ? <p className="notice">{COPY.reframe.deleted}</p> : null}
      {params.added ? <p className="notice">{COPY.reframe.accepted}</p> : null}
      {params.refreshed ? <p className="notice">{COPY.reframe.refreshed}</p> : null}
      {params.error ? <p className="notice notice-warn">{COPY.reframe.error}</p> : null}
      {params.aiOff || !aiEnabled ? (
        <p className="notice notice-warn">{COPY.reframe.aiOff}</p>
      ) : null}

      <section className="panel" aria-labelledby="reframe-heading">
        <h2 className="label" id="reframe-heading">
          {COPY.reframe.heading}
        </h2>

        {aiEnabled ? (
          <form className="settings-form" action={startReframe}>
            {openItems.length > 0 ? (
              <label className="field">
                <span>{COPY.reframe.taskLabel}</span>
                <select name="taskId" defaultValue="">
                  <option value="">{COPY.reframe.taskNone}</option>
                  {openItems.map((item) => (
                    <option key={item.task_id} value={item.task_id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="field">
              <span>{COPY.reframe.inputLabel}</span>
              <textarea
                name="text"
                rows={5}
                maxLength={4000}
                placeholder={COPY.reframe.placeholder}
                required
              />
            </label>
            <PendingButton
              className="button"
              label={COPY.reframe.submit}
              busy={COPY.ai.busy}
            />
          </form>
        ) : (
          <p className="hint">{COPY.reframe.aiOff}</p>
        )}

        {dump ? (
          <div className="reading">
            <p className="label">
              {COPY.reframe.categoryLabel}: {categoryLabel(dump.category)}
            </p>
            <p className="reframe-text">{dump.text}</p>
            {dump.fallback === 1 ? (
              <p className="notice notice-warn">{COPY.reframe.fallbackNotice}</p>
            ) : null}
            <p className="label">{COPY.reframe.diagnosisLabel}</p>
            <p className="current">{dump.diagnosis}</p>
            <p className="label">{COPY.reframe.actionLabel}</p>
            <p className="current">{dump.micro_action}</p>
            {sourceTask ? (
              <p className="hint small">
                {COPY.reframe.shrinksLabel}: {sourceTask.title}
              </p>
            ) : null}

            {dump.safety === 1 ? null : dump.task_id ? (
              <p className="notice">{COPY.reframe.accepted}</p>
            ) : (
              <form action={acceptMicroAction} style={{ marginTop: 12 }}>
                <input type="hidden" name="dumpId" value={dump.id} />
                <button className="button" type="submit">
                  {COPY.reframe.accept}
                </button>
              </form>
            )}

            <div className="inline-form" style={{ marginTop: 12 }}>
              {aiEnabled && dump.safety !== 1 ? (
                <form action={regenerateReframe}>
                  <input type="hidden" name="dumpId" value={dump.id} />
                  <PendingButton
                    className="button button-quiet"
                    label={COPY.reframe.another}
                    busy={COPY.ai.busy}
                  />
                </form>
              ) : null}
              <form action={deleteReframe}>
                <input type="hidden" name="dumpId" value={dump.id} />
                <button className="button button-quiet" type="submit">
                  {COPY.reframe.delete}
                </button>
              </form>
            </div>

            {aiEnabled ? (
              <details className="reframe-edit">
                <summary className="label">{COPY.reframe.editLabel}</summary>
                <form className="settings-form" action={editReframe}>
                  <input type="hidden" name="dumpId" value={dump.id} />
                  <label className="field">
                    <span>{COPY.reframe.inputLabel}</span>
                    <textarea
                      name="text"
                      rows={5}
                      maxLength={4000}
                      defaultValue={dump.text}
                      required
                    />
                  </label>
                  <PendingButton
                    className="button button-quiet"
                    label={COPY.reframe.save}
                    busy={COPY.ai.busy}
                  />
                </form>
              </details>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="panel" aria-labelledby="past-heading">
        <h2 className="label" id="past-heading">
          {COPY.reframe.pastHeading}
        </h2>
        {past.length === 0 ? (
          <p className="empty">{COPY.reframe.emptyPast}</p>
        ) : (
          <ul className="task-list">
            {past.map((item) => (
              <li className="task" key={item.id}>
                <span className="task-title">
                  {item.text.length > 90 ? `${item.text.slice(0, 90)}…` : item.text}
                </span>
                <span className="task-meta">{categoryLabel(item.category)}</span>
                <Link className="link" href={`/reframe?dump=${item.id}`}>
                  {COPY.reframe.open}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
