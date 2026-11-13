import Link from "next/link";
import { COPY } from "@/copy";
import { CONFIG } from "@/config";
import { reconcileCheckins } from "@/db/checkins";
import { getOrCreateDayForDate, isPaused, parseLocalTimestamp } from "@/db/days";
import { getDatabase } from "@/db/index";
import { listHabits, occurrenceForTask, streakFor } from "@/db/habits";
import { getHeatMap, getPlayerState } from "@/db/player";
import { listPlan, planProgress } from "@/db/plan";
import { latestProposedProposal, proposalItems } from "@/db/plan-proposals";
import { listPulsesForDay, pendingPulse } from "@/db/pulses";
import { getSettings } from "@/db/settings";
import { listOpenTasksBefore } from "@/db/tasks";
import { xpForDay } from "@/db/xp";
import { slotKey } from "@/game/pulses";
import { taskXp } from "@/game/rules";
import { localDateString } from "@/time";
import { CheckInWatcher } from "./check-in";
import { CompletionWatcher } from "./completion-watcher";
import { RewardWatcher } from "./reward-watcher";
import { dayStatus } from "./ui/day-status";
import { SiteHeader } from "./ui/site-header";
import { CropIcon, FlowerIcon, Mascot, QuestIcon, SproutIcon } from "./ui/sprites";
import { StatsHud } from "./ui/stats-hud";
import {
  acceptPlanProposal,
  aiShrinkTask,
  discardPlanProposal,
  proposePlan,
  replanWithAi,
} from "./ai-actions";
import { PendingButton } from "./pending-button";
import {
  addHabit,
  addTask,
  answerCheckin,
  archiveHabitAction,
  bringOver,
  closeDayAction,
  moveTask,
  pauseCheckins,
  resumeCheckins,
  setProfile,
  shrinkTask,
  skipHabit,
  startDay,
  toggleHabit,
  toggleTask,
} from "./actions";

// The page reads SQLite on every request, so it must never be prerendered: a
// static page would be built against an empty database and freeze there.
export const dynamic = "force-dynamic";

type Summary = {
  xp: number;
  answered: number;
  missed: number;
  longestCombo: number;
  tasksDone: number;
  tasksTotal: number;
  carryOver: number;
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    shrink?: string;
    habitError?: string;
    proposal?: string;
    added?: string;
    shrunk?: string;
    shapeError?: string;
    aiOff?: string;
    replanned?: string;
    replanFallback?: string;
    completed?: string;
  }>;
}) {
  const params = await searchParams;
  const db = getDatabase();
  const date = localDateString();
  let day = getOrCreateDayForDate(db, date);
  const settings = getSettings(db);

  // Opening the app after a sleep or restart settles the check-in clock before
  // anything is rendered (PULSE-4). It is idempotent.
  if (day.plan_status === "active") {
    reconcileCheckins(db, day, settings);
    day = getOrCreateDayForDate(db, date);
  }

  const player = getPlayerState(db);
  const plan = listPlan(db, day.id);
  const progress = planProgress(db, day.id);
  const pulses = listPulsesForDay(db, day.id);
  const pending = day.plan_status === "active" ? pendingPulse(db, day.id) : undefined;
  const paused = isPaused(db, day.id);
  const habits = listHabits(db);
  const carried = day.plan_status === "closed" ? [] : listOpenTasksBefore(db, date, day.id, 5);
  const proposal =
    day.plan_status === "closed" ? undefined : latestProposedProposal(db, day.id);
  const proposedItems = proposal ? proposalItems(db, proposal.id) : [];
  const heat = getHeatMap(db, 84);
  const todayXp = xpForDay(db, day.id);
  const summary: Summary | null = day.summary
    ? (JSON.parse(day.summary) as Summary)
    : null;

  const lastPulse = pulses[pulses.length - 1];
  const nextDueAt =
    day.plan_status === "active" && day.confirmed_at && !paused
      ? slotKey(
          new Date(
            (lastPulse
              ? parseLocalTimestamp(lastPulse.due_at)
              : parseLocalTimestamp(day.confirmed_at)
            ).getTime() +
              settings.checkin_interval_minutes * 60_000,
          ),
        )
      : null;

  const current = plan.find((item) => item.status === "open");
  const completedTaskId = Number(params.completed);
  const completedId =
    Number.isInteger(completedTaskId) && completedTaskId > 0 ? completedTaskId : null;
  const completedItem =
    completedId === null ? undefined : plan.find((item) => item.task_id === completedId);
  const completedRewardXp = completedItem ? taskXp(completedItem.cognitive_load) : 0;
  const doneHabitIds = new Set<number>();
  for (const item of plan) {
    if (item.status === "done" && item.habit_id) {
      doneHabitIds.add(item.habit_id);
    }
  }
  const headerStatus = dayStatus(day.plan_status, paused);

  return (
    <main className="shell">
      <SiteHeader
        active="today"
        title={COPY.nav.home}
        date={date}
        status={headerStatus.label}
        statusState={headerStatus.state}
      />

      <CompletionWatcher taskId={completedId} />
      <RewardWatcher
        completedTaskId={completedId}
        rewardXp={completedRewardXp}
        level={player.level.level}
        levelName={player.level.name}
        multiplier={player.multiplier}
      />

      <div className="notice-stack">
        {params.added ? <p className="notice">{COPY.ai.added}</p> : null}
        {params.shrunk ? <p className="notice">{COPY.ai.shrinkNotice}</p> : null}
        {params.shapeError ? (
          <p className="notice notice-warn">{COPY.ai.shapeError}</p>
        ) : null}
        {params.aiOff ? <p className="notice notice-warn">{COPY.ai.off}</p> : null}
        {params.replanned ? <p className="notice">{COPY.ai.replanned}</p> : null}
        {params.replanFallback ? (
          <p className="notice notice-warn">{COPY.ai.replanFallback}</p>
        ) : null}
      </div>

      <StatsHud player={player} todayXp={todayXp} celebrate={completedId !== null} />

      <div className={`stage${day.plan_status === "active" ? " stage-running" : ""}`}>
        {day.plan_status === "closed" ? (
          <section className="panel closed-panel" aria-labelledby="closed-heading">
            <h2 className="label" id="closed-heading">
              {COPY.home.closedHeading}
            </h2>
            <p className="lede">{COPY.home.closedLede}</p>
            {summary ? (
              <dl className="values">
                <dt>{COPY.dayClose.xp}</dt>
                <dd>{summary.xp}</dd>
                <dt>{COPY.dayClose.answered}</dt>
                <dd>{summary.answered}</dd>
                <dt>{COPY.dayClose.missed}</dt>
                <dd>{summary.missed}</dd>
                <dt>{COPY.dayClose.longest}</dt>
                <dd>{summary.longestCombo}</dd>
                <dt>{COPY.dayClose.tasks}</dt>
                <dd>
                  {summary.tasksDone}/{summary.tasksTotal}
                </dd>
                <dt>{COPY.dayClose.carry}</dt>
                <dd>{summary.carryOver}</dd>
              </dl>
            ) : null}
          </section>
        ) : null}

        {day.plan_status === "active" ? (
          <section className="panel dialogue-panel stage-checkin" aria-labelledby="checkin-heading">
            <h2 className="label" id="checkin-heading">
              {COPY.checkin.heading}
            </h2>
            <div className={`dialogue${pending ? " dialogue--due" : ""}`}>
              <div className="mascot-wrap">
                <Mascot className="mascot" />
                <span className="mascot-alert" aria-hidden="true">
                  !
                </span>
              </div>
              <div className="dialogue-body">
                <p className="dialogue-speaker">{COPY.checkin.heading}</p>
                {pending ? (
                  <form action={answerCheckin}>
                    <input type="hidden" name="pulseId" value={pending.id} />
                    <p className="dialogue-text checkin-question">{COPY.checkin.question}</p>
                    <p className="dialogue-task">
                      {current ? current.title : COPY.home.noCurrent}
                    </p>
                    {pending.quiet === 1 ? (
                      <p className="hint small">{COPY.checkin.quietLede}</p>
                    ) : null}
                    <label className="field">
                      <span>{COPY.checkin.noteLabel}</span>
                      <input
                        type="text"
                        name="note"
                        maxLength={280}
                        placeholder={COPY.checkin.notePlaceholder}
                      />
                    </label>
                    <div className="dialogue-options">
                      <button
                        className="button dialogue-option"
                        type="submit"
                        name="response"
                        value="on_track"
                      >
                        {COPY.checkin.onTrack}
                      </button>
                      <button
                        className="button button-alt dialogue-option"
                        type="submit"
                        name="response"
                        value="pivot"
                      >
                        {COPY.checkin.pivot}
                      </button>
                      <button
                        className="button button-quiet dialogue-option"
                        type="submit"
                        name="response"
                        value="drifted"
                      >
                        {COPY.checkin.drifted}
                      </button>
                    </div>
                    <p className="hint small">{COPY.checkin.quickHint}</p>
                    <p className="hint small">{COPY.checkin.missedHelper}</p>
                  </form>
                ) : (
                  <>
                    <p className="dialogue-text">
                      {paused ? COPY.checkin.paused : COPY.checkin.idle}
                    </p>
                    <p className="dialogue-task">
                      {current ? current.title : COPY.home.noCurrent}
                    </p>
                  </>
                )}

                <div className="dialogue-actions">
                  {paused ? (
                    <form action={resumeCheckins}>
                      <button className="button button-quiet dialogue-option" type="submit">
                        {COPY.checkin.resume}
                      </button>
                    </form>
                  ) : (
                    <form action={pauseCheckins}>
                      <button className="button button-quiet dialogue-option" type="submit">
                        {COPY.checkin.pause}
                      </button>
                    </form>
                  )}
                  <form action={replanWithAi}>
                    <PendingButton
                      className="button button-quiet dialogue-option"
                      label={COPY.plan.replan}
                      busy={COPY.ai.busy}
                    />
                  </form>
                  <form action={closeDayAction}>
                    <button className="button button-quiet dialogue-option" type="submit">
                      {COPY.dayClose.close}
                    </button>
                  </form>
                </div>
              </div>
            </div>

            {params.shrink && current ? (
              <div className="shrink-box">
                <p className="checkin-question">{COPY.checkin.driftedHeading}</p>
                <p className="hint small">{COPY.checkin.driftedLede}</p>
                <p className="hint small">
                  <Link className="link" href="/reframe">
                    {COPY.reframe.fromDrift}
                  </Link>
                </p>
                {settings.ai_enabled === 1 ? (
                  <form action={aiShrinkTask} style={{ marginTop: 12 }}>
                    <input type="hidden" name="taskId" value={current.task_id} />
                    <PendingButton
                      className="button"
                      label={COPY.ai.askSmaller}
                      busy={COPY.ai.busy}
                    />
                  </form>
                ) : null}
                <details
                  className="preset-steps"
                  open={settings.ai_enabled !== 1}
                >
                  <summary className="hint small">{COPY.ai.presetToggle}</summary>
                  <div className="answer-row">
                    {COPY.checkin.microActions.map((action) => (
                      <form action={shrinkTask} key={action}>
                        <input type="hidden" name="taskId" value={current.task_id} />
                        <input type="hidden" name="microAction" value={action} />
                        <button className="button button-quiet" type="submit">
                          {action}
                        </button>
                      </form>
                    ))}
                  </div>
                </details>
              </div>
            ) : null}

            <CheckInWatcher
              intervalMinutes={settings.checkin_interval_minutes}
              level={settings.interruption_level}
              nextDueAt={nextDueAt}
              pending={Boolean(pending)}
              pendingId={pending?.id ?? null}
              pendingQuiet={pending?.quiet === 1}
              paused={paused}
              quietStart={settings.quiet_start}
              quietEnd={settings.quiet_end}
            />
          </section>
        ) : null}

        <div className="stage-main">
          {day.plan_status === "active" ? (
            <section className="panel quest-panel" aria-labelledby="current-heading">
              <h2 className="label" id="current-heading">
                <QuestIcon /> {COPY.home.currentLabel}
              </h2>
              <div className="quest-body">
                {current ? (
                  <p className="quest-task">{current.title}</p>
                ) : (
                  <p className="quest-empty">{COPY.home.noCurrent}</p>
                )}
                <div
                  className="quest-slots"
                  role="img"
                  aria-label={`${progress.done}/${progress.total} ${COPY.dayClose.tasks.toLowerCase()}`}
                >
                  {Array.from({ length: progress.total }, (_, index) => {
                    const done = index < progress.done;
                    return (
                      <span className={`quest-slot${done ? " is-done" : ""}`} key={index}>
                        {done ? <SproutIcon className="quest-slot-sprout" /> : null}
                      </span>
                    );
                  })}
                </div>
                <p className="quest-progress">
                  {progress.done}/{progress.total} {COPY.dayClose.tasks.toLowerCase()}
                </p>
                {current ? (
                  <form action={toggleTask}>
                    <input type="hidden" name="taskId" value={current.task_id} />
                    <button className="button quest-complete" type="submit">
                      {COPY.task.markDone}
                    </button>
                  </form>
                ) : null}
              </div>
            </section>
          ) : null}

      <section className="panel plan-panel" aria-labelledby="plan-heading">
        <h2 className="label" id="plan-heading">
          {COPY.home.planHeading}
        </h2>

        {day.plan_status === "draft" ? (
          <>
            <form className="inline-form" action={setProfile}>
              <label className="field">
                <span>{COPY.home.profileLabel}</span>
                <select name="profile" defaultValue={day.profile ?? "maintenance"}>
                  <option value="sprinting">{COPY.home.profiles.sprinting}</option>
                  <option value="maintenance">{COPY.home.profiles.maintenance}</option>
                  <option value="low_energy">{COPY.home.profiles.low_energy}</option>
                </select>
              </label>
              <button className="button button-quiet" type="submit">
                {COPY.settings.save}
              </button>
            </form>
            <p className="hint small">{COPY.home.profileHint}</p>
            {settings.ai_enabled === 1 ? (
              <form className="settings-form" action={proposePlan} style={{ marginTop: 16 }}>
                <label className="field">
                  <span>{COPY.ai.shapeHeading}</span>
                  <textarea
                    name="source"
                    rows={4}
                    maxLength={CONFIG.ai.maxInputChars}
                    placeholder={COPY.ai.shapePlaceholder}
                    required
                  />
                </label>
                <p className="hint small">{COPY.ai.shapeHint}</p>
                <PendingButton
                  className="button button-quiet"
                  label={COPY.ai.shapeButton}
                  busy={COPY.ai.busy}
                />
              </form>
            ) : null}
          </>
        ) : null}

        {day.plan_status !== "closed" ? (
          <form className="task-form" action={addTask} style={{ marginTop: 12 }}>
            <input
              className="task-input"
              type="text"
              name="title"
              placeholder={COPY.task.placeholder}
              maxLength={CONFIG.tasks.maxTitleLength}
              autoComplete="off"
              required
            />
            <select className="task-input" name="cognitiveLoad" defaultValue="medium" aria-label={COPY.task.loadLabel}>
              <option value="light">{COPY.task.loads.light}</option>
              <option value="medium">{COPY.task.loads.medium}</option>
              <option value="heavy">{COPY.task.loads.heavy}</option>
            </select>
            <button className="button" type="submit">
              {COPY.task.addButton}
            </button>
          </form>
        ) : null}

        {proposal ? (
          <div className="proposal-review">
            <form action={acceptPlanProposal}>
              <input type="hidden" name="proposalId" value={proposal.id} />
              <p className="label">{COPY.ai.reviewHeading}</p>
              <p className="hint small">{COPY.ai.reviewLede}</p>
              {proposal.fallback === 1 ? (
                <p className="notice notice-warn">{COPY.ai.fallbackNotice}</p>
              ) : null}
              <ul className="proposal-list">
                {proposedItems.map((item) => (
                  <li className="proposal-item" key={item.id}>
                    <input
                      type="checkbox"
                      name={`include-${item.id}`}
                      defaultChecked
                      aria-label={`${COPY.ai.itemTitle}: ${item.title}`}
                    />
                    <input
                      className="task-input"
                      type="text"
                      name={`title-${item.id}`}
                      defaultValue={item.title}
                      maxLength={CONFIG.tasks.maxTitleLength}
                      aria-label={COPY.ai.itemTitle}
                    />
                    <input
                      className="task-input proposal-minutes"
                      type="number"
                      name={`minutes-${item.id}`}
                      defaultValue={item.estimated_minutes ?? 15}
                      min={5}
                      max={180}
                      aria-label={COPY.ai.itemMinutes}
                    />
                    <select
                      className="task-input proposal-load"
                      name={`load-${item.id}`}
                      defaultValue={item.cognitive_load}
                      aria-label={COPY.ai.itemLoad}
                    >
                      <option value="light">{COPY.task.loads.light}</option>
                      <option value="medium">{COPY.task.loads.medium}</option>
                      <option value="heavy">{COPY.task.loads.heavy}</option>
                    </select>
                  </li>
                ))}
              </ul>
              <div className="answer-row">
                <button className="button" type="submit">
                  {COPY.ai.accept}
                </button>
              </div>
            </form>
            <form action={discardPlanProposal}>
              <input type="hidden" name="proposalId" value={proposal.id} />
              <button className="button button-quiet" type="submit">
                {COPY.ai.discard}
              </button>
            </form>
          </div>
        ) : null}

        {plan.length === 0 ? (
          <p className="empty">{COPY.home.empty}</p>
        ) : (
          <ul className="task-list">
            {plan.map((item, index) => {
              const done = item.status === "done";
              const isCurrent = current?.task_id === item.task_id;
              const justDone = item.task_id === completedId;
              const taskOccurrence = item.habit_id
                ? occurrenceForTask(db, item.task_id)
                : undefined;
              return (
                <li
                  className={`task${done ? " task-done" : ""}${isCurrent ? " task-current" : ""}${justDone ? " task-just-done" : ""}`}
                  key={item.id}
                >
                  <form action={toggleTask}>
                    <input type="hidden" name="taskId" value={item.task_id} />
                    <button
                      className="task-toggle"
                      type="submit"
                      aria-label={done ? COPY.task.markOpen : COPY.task.markDone}
                      aria-pressed={done}
                    >
                      {done ? COPY.task.taskDoneMark : COPY.task.taskOpenMark}
                    </button>
                  </form>
                  <span className="task-title-wrap">
                    {done ? <SproutIcon className="task-sprout" /> : null}
                    <span className="task-title">{item.title}</span>
                  </span>
                  <span className="task-meta">
                    {item.planned_start ? `${item.planned_start} · ` : ""}
                    {COPY.task.loads[item.cognitive_load]}
                    {item.habit_id ? ` · ${COPY.task.habitTag}` : ""}
                  </span>
                  {day.plan_status !== "closed" ? (
                    <span className="task-actions">
                      <form action={moveTask}>
                        <input type="hidden" name="taskId" value={item.task_id} />
                        <input type="hidden" name="direction" value="up" />
                        <button
                          className="icon-button"
                          type="submit"
                          disabled={index === 0}
                          aria-label={COPY.task.reorderUp}
                        >
                          ↑
                        </button>
                      </form>
                      <form action={moveTask}>
                        <input type="hidden" name="taskId" value={item.task_id} />
                        <input type="hidden" name="direction" value="down" />
                        <button
                          className="icon-button"
                          type="submit"
                          disabled={index === plan.length - 1}
                          aria-label={COPY.task.reorderDown}
                        >
                          ↓
                        </button>
                      </form>
                      {taskOccurrence && taskOccurrence.outcome === "pending" ? (
                        <form action={skipHabit}>
                          <input
                            type="hidden"
                            name="occurrenceId"
                            value={taskOccurrence.id}
                          />
                          <button className="icon-button" type="submit">
                            {COPY.habits.skip}
                          </button>
                        </form>
                      ) : null}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {plan.some((item) => item.planned_start) ? (
          <p className="hint small">{COPY.insights.planTimes}</p>
        ) : null}

        {day.plan_status === "draft" ? (
          <div style={{ marginTop: 16 }}>
            <form action={startDay}>
              <button className="button" type="submit">
                {COPY.plan.start}
              </button>
            </form>
            <p className="hint small">{COPY.plan.startHint}</p>
          </div>
        ) : null}

        {carried.length > 0 ? (
          <div style={{ marginTop: 24 }}>
            <p className="label">{COPY.plan.carryHeading}</p>
            <p className="hint small">{COPY.plan.carryLede}</p>
            <ul className="task-list">
              {carried.map((task) => (
                <li className="task" key={task.id}>
                  <span className="task-title">{task.title}</span>
                  <span className="task-actions">
                    <form action={bringOver}>
                      <input type="hidden" name="taskId" value={task.id} />
                      <button className="icon-button" type="submit">
                        {COPY.plan.bringOver}
                      </button>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      </div>

      <section className="panel stage-habits habits-panel" aria-labelledby="habits-heading">
        <h2 className="label" id="habits-heading">
          <FlowerIcon /> {COPY.habits.heading}
        </h2>

        {params.habitError ? (
          <p className="notice notice-warn">{COPY.habits.error}</p>
        ) : null}

        {habits.length === 0 ? (
          <p className="empty">{COPY.habits.empty}</p>
        ) : (
          <ul className="habit-list garden">
            {habits.map((habit) => {
              const streak = streakFor(db, habit.id);
              const stage: 0 | 1 | 2 | 3 | 4 =
                streak <= 0 ? 0 : streak === 1 ? 1 : streak <= 3 ? 2 : streak <= 6 ? 3 : 4;
              const doneToday = doneHabitIds.has(habit.id);
              return (
                <li
                  className={`habit${habit.status === "paused" ? " plot-paused" : ""}`}
                  key={habit.id}
                >
                  <div className="plot-crop">
                    <CropIcon stage={stage} className="crop-sprite" />
                    {doneToday ? (
                      <span className="plot-sparkle" aria-hidden="true">
                        ✦
                      </span>
                    ) : null}
                  </div>
                  <div className="plot-info">
                    <span className="task-title">{habit.name}</span>
                    <span className="task-meta">
                      {COPY.habits.frequencies[habit.frequency]} · {streak} {COPY.habits.streak}
                      {habit.status === "paused" ? ` · ${COPY.habits.pausedTag}` : ""}
                    </span>
                  </div>
                  <span className="task-actions plot-actions">
                    <form action={toggleHabit}>
                      <input type="hidden" name="habitId" value={habit.id} />
                      <input
                        type="hidden"
                        name="status"
                        value={habit.status === "paused" ? "active" : "paused"}
                      />
                      <button className="icon-button" type="submit">
                        {habit.status === "paused" ? COPY.habits.resume : COPY.habits.pause}
                      </button>
                    </form>
                    <form action={archiveHabitAction}>
                      <input type="hidden" name="habitId" value={habit.id} />
                      <button className="icon-button" type="submit">
                        {COPY.habits.archive}
                      </button>
                    </form>
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <form className="settings-form habit-form" action={addHabit}>
          <p className="label">{COPY.habits.addLabel}</p>
          <label className="field">
            <span>{COPY.habits.name}</span>
            <input
              type="text"
              name="name"
              maxLength={80}
              placeholder={COPY.habits.namePlaceholder}
              required
            />
          </label>
          <label className="field">
            <span>{COPY.habits.frequency}</span>
            <select name="frequency" defaultValue="daily">
              {Object.entries(COPY.habits.frequencies).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{COPY.habits.detail}</span>
            <input type="text" name="detail" placeholder={COPY.habits.detailPlaceholder} />
            <span className="hint small">{COPY.habits.detailHint}</span>
          </label>
          <label className="field">
            <span>{COPY.habits.load}</span>
            <select name="cognitiveLoad" defaultValue="light">
              <option value="light">{COPY.task.loads.light}</option>
              <option value="medium">{COPY.task.loads.medium}</option>
              <option value="heavy">{COPY.task.loads.heavy}</option>
            </select>
          </label>
          <label className="field">
            <span>
              <input type="checkbox" name="essential" /> {COPY.habits.essential}
            </span>
          </label>
          <button className="button" type="submit">
            {COPY.habits.addButton}
          </button>
        </form>
      </section>
      </div>

      <section className="panel heat-panel" aria-labelledby="heat-heading">
        <div className="heat-copy">
          <h2 className="label" id="heat-heading">
            {COPY.progress.integrityLabel}
          </h2>
          <p className="hint small">{COPY.progress.integrityHint}</p>
        </div>
        <div
          className="heatmap"
          role="img"
          aria-label={`${COPY.progress.integrityHint} ${Math.round(player.integrity * 100)}%`}
        >
          {heat.map((cell) => (
            <span
              className={`heat heat-${cell.level}`}
              key={cell.date}
              title={`${cell.date} · ${cell.activity}`}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
