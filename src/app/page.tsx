import { COPY } from "@/copy";
import { CONFIG } from "@/config";
import { getOrCreateDayForDate } from "@/db/days";
import { getDatabase } from "@/db/index";
import { listTasksForDay } from "@/db/tasks";
import { localDateString } from "@/time";
import { addTask, toggleTask } from "./actions";

// The page reads SQLite on every request, so it must never be prerendered: a
// static page would be built against an empty database and freeze there.
export const dynamic = "force-dynamic";

export default function Home() {
  const db = getDatabase();
  const day = getOrCreateDayForDate(db, localDateString());
  const tasks = listTasksForDay(db, day.id);

  return (
    <main className="shell">
      <header className="masthead">
        <h1 className="wordmark">{COPY.home.title}</h1>
        <p className="lede">{COPY.home.lede}</p>
        <p className="hint">
          {COPY.home.dayLabel} {COPY.home.daySeparator} {day.date}
        </p>
      </header>

      <section className="panel" aria-labelledby="add-task-heading">
        <h2 className="label" id="add-task-heading">
          {COPY.home.formLabel}
        </h2>
        <form className="task-form" action={addTask}>
          <input
            className="task-input"
            type="text"
            name="title"
            placeholder={COPY.home.titlePlaceholder}
            maxLength={CONFIG.tasks.maxTitleLength}
            autoComplete="off"
            required
          />
          <button className="button" type="submit">
            {COPY.home.addButton}
          </button>
        </form>
      </section>

      <section className="panel" aria-labelledby="task-list-heading">
        <h2 className="label" id="task-list-heading">
          {COPY.home.listHeading}
        </h2>
        {tasks.length === 0 ? (
          <p className="empty">{COPY.home.empty}</p>
        ) : (
          <ul className="task-list">
            {tasks.map((task) => {
              const done = task.status === "done";
              return (
                <li className={done ? "task task-done" : "task"} key={task.id}>
                  <form action={toggleTask}>
                    <input type="hidden" name="taskId" value={task.id} />
                    <button
                      className="task-toggle"
                      type="submit"
                      aria-label={done ? COPY.home.markOpen : COPY.home.markDone}
                      aria-pressed={done}
                    >
                      {done ? COPY.home.taskDoneMark : COPY.home.taskOpenMark}
                    </button>
                  </form>
                  <span className="task-title">{task.title}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
