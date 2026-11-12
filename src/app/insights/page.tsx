import { Fragment } from "react";
import Link from "next/link";
import { COPY } from "@/copy";
import { getOrCreateDayForDate } from "@/db/days";
import { getDatabase } from "@/db/index";
import {
  getCompletedWeekSummary,
  getDailySummary,
  getDriftHeatmap,
  getHabitInsights,
  getPeakWindows,
  getProfileCompletion,
  getWeeklySummary,
  getWeeklyTrends,
} from "@/db/insights";
import { getSettings } from "@/db/settings";
import { localDateString } from "@/time";
import { SiteHeader } from "../ui/site-header";

// Like the dashboard, this page reads SQLite per request. Insight views are
// derived on demand so they always describe the same history the rest of the
// app is writing (INS-1).

export const dynamic = "force-dynamic";

function percent(rate: number | null): string {
  return rate === null ? COPY.insights.noValue : `${Math.round(rate * 100)}%`;
}

function shortDate(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function hourLabel(hour: number): string {
  return String(hour).padStart(2, "0");
}

export default async function InsightsPage() {
  const db = getDatabase();
  const day = getOrCreateDayForDate(db, localDateString());
  const settings = getSettings(db);
  const daily = getDailySummary(db, day.id);
  const week = getWeeklySummary(db);
  const lastWeek = getCompletedWeekSummary(db);
  const heat = getDriftHeatmap(db);
  const profiles = getProfileCompletion(db);
  const trends = getWeeklyTrends(db);
  const habits = getHabitInsights(db);
  const peaks = getPeakWindows(db);

  const cellByKey = new Map(
    heat.cells.map((cell) => [`${cell.weekday}-${cell.hour}`, cell]),
  );

  const dailyLines: string[] = [];
  if (!daily.hasActivity) {
    dailyLines.push(COPY.insights.blankDay);
  } else {
    dailyLines.push(
      daily.tasksTotal > 0
        ? COPY.insights.tasksLine(daily.tasksDone, daily.tasksTotal)
        : COPY.insights.noTasks,
    );
    dailyLines.push(
      daily.answered > 0
        ? COPY.insights.checkinsLine(daily.answered, daily.onTrack)
        : COPY.insights.noCheckins,
    );
    if (daily.drifted + daily.missed > 0) {
      dailyLines.push(COPY.insights.driftLine(daily.drifted + daily.missed));
    }
    if (daily.xp > 0) {
      dailyLines.push(COPY.insights.xpLine(daily.xp));
    }
  }

  const weekLines: string[] = [];
  if (week.activeDays > 0) {
    weekLines.push(COPY.insights.weekLine(week.activeDays, week.tasksDone));
    if (week.consistency !== null) {
      weekLines.push(COPY.insights.weekConsistency(percent(week.consistency)));
    }
    if (week.bestDay) {
      weekLines.push(
        COPY.insights.bestDay(
          shortDate(week.bestDay.date),
          week.bestDay.tasksDone,
        ),
      );
    }
  } else {
    weekLines.push(COPY.insights.weekEmpty);
  }

  const lastWeekLines: string[] = [];
  if (lastWeek.activeDays > 0) {
    lastWeekLines.push(
      COPY.insights.lastWeekLine(lastWeek.activeDays, lastWeek.tasksDone),
    );
    if (lastWeek.consistency !== null) {
      lastWeekLines.push(
        COPY.insights.lastWeekConsistency(percent(lastWeek.consistency)),
      );
    }
    if (lastWeek.bestDay) {
      lastWeekLines.push(
        COPY.insights.bestDay(
          shortDate(lastWeek.bestDay.date),
          lastWeek.bestDay.tasksDone,
        ),
      );
    }
  }

  return (
    <main className="shell insights-shell">
      <SiteHeader
        active="insights"
        title={COPY.insights.heading}
        lede={COPY.insights.lede}
        date={localDateString()}
      />

      <section className="panel" aria-labelledby="summary-heading">
        <h2 className="label" id="summary-heading">
          {COPY.insights.summaryHeading}
        </h2>
        <div className="insight-summary">
          <p className="label">{COPY.insights.todayHeading}</p>
          <ul className="observation-list">
            {dailyLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="label">{COPY.insights.summaryHeading}</p>
          <ul className="observation-list">
            {weekLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="label">{COPY.insights.lastWeekHeading}</p>
          {lastWeekLines.length > 0 ? (
            <ul className="observation-list">
              {lastWeekLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="empty">{COPY.insights.lastWeekEmpty}</p>
          )}
        </div>
      </section>

      <section className="panel" aria-labelledby="heat-heading">
        <h2 className="label" id="heat-heading">
          {COPY.insights.heatHeading}
        </h2>
        <p className="hint small">{COPY.insights.heatLede}</p>
        {!heat.hasData ? (
          <p className="empty">{COPY.insights.noData}</p>
        ) : (
          <div className="drift-board">
            <div
              className="drift-grid"
              role="img"
              aria-label={`${COPY.insights.heatHeading}: ${heat.drifts} drift moments across ${heat.answered + heat.missed} check-ins.`}
            >
              <span />
              {Array.from({ length: 24 }, (_, hour) => (
                <span className="drift-hour" key={hour}>
                  {hour % 3 === 0 ? hourLabel(hour) : ""}
                </span>
              ))}
              {COPY.insights.weekdays.map((label, index) => {
                const weekday = (index + 1) % 7; // Monday-first display
                return (
                  <Fragment key={weekday}>
                    <span className="drift-weekday">{label}</span>
                    {Array.from({ length: 24 }, (_, hour) => {
                      const cell = cellByKey.get(`${weekday}-${hour}`);
                      return (
                        <span
                          className={`drift-cell drift-${cell?.level ?? 0}`}
                          key={`${weekday}-${hour}`}
                          title={
                            cell && cell.total > 0
                              ? COPY.insights.heatCell(label, hour, cell.drifts)
                              : COPY.insights.heatEmptyCell(label, hour)
                          }
                        />
                      );
                    })}
                  </Fragment>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="panel" aria-labelledby="profile-heading">
        <h2 className="label" id="profile-heading">
          {COPY.insights.profileHeading}
        </h2>
        <p className="hint small">{COPY.insights.profileLede}</p>
        <ul className="profile-list">
          {profiles.map((profile) => (
            <li className="profile-row" key={profile.profile}>
              <span className="profile-name">
                {COPY.home.profiles[profile.profile]}
              </span>
              <span className="profile-bar" aria-hidden="true">
                <span
                  className="profile-fill"
                  style={{ width: `${Math.round((profile.rate ?? 0) * 100)}%` }}
                />
              </span>
              <span className="profile-rate">
                {profile.tasksTotal > 0
                  ? COPY.insights.profileLine(
                      profile.tasksDone,
                      profile.tasksTotal,
                      percent(profile.rate),
                    )
                  : COPY.insights.profileEmpty}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel" aria-labelledby="trend-heading">
        <h2 className="label" id="trend-heading">
          {COPY.insights.trendsHeading}
        </h2>
        <p className="hint small">{COPY.insights.trendsLede}</p>
        <div className="table-scroll">
          <table className="trend-table">
            <thead>
              <tr>
                <th scope="col">{COPY.insights.tableWeek}</th>
                <th scope="col">{COPY.insights.tableConsistency}</th>
                <th scope="col">{COPY.insights.tableCombo}</th>
                <th scope="col">{COPY.insights.tableIntegrity}</th>
              </tr>
            </thead>
            <tbody>
              {trends.map((trend) => (
                <tr key={trend.weekStart}>
                  <th scope="row">{shortDate(trend.weekStart)}</th>
                  <td>
                    <span className="trend-bar" aria-hidden="true">
                      <span
                        className="trend-fill"
                        style={{
                          width: `${Math.round((trend.consistency ?? 0) * 100)}%`,
                        }}
                      />
                    </span>
                    {percent(trend.consistency)}
                  </td>
                  <td>{trend.longestCombo}</td>
                  <td>{percent(trend.integrity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" aria-labelledby="habit-insights-heading">
        <h2 className="label" id="habit-insights-heading">
          {COPY.insights.habitsHeading}
        </h2>
        <p className="hint small">{COPY.insights.habitsLede}</p>
        {habits.length === 0 ? (
          <p className="empty">{COPY.insights.emptyHabits}</p>
        ) : (
          <ul className="habit-insights">
            {habits.map((habit) => (
              <li className="habit-insight" key={habit.habitId}>
                <div className="habit-insight-top">
                  <span className="task-title">{habit.name}</span>
                  <span className="task-meta">
                    {habit.status === "paused"
                      ? `${COPY.insights.habitPaused} · `
                      : ""}
                    {COPY.insights.habitStreak(habit.streak)}
                  </span>
                </div>
                <p className="hint small">
                  {habit.decided > 0
                    ? COPY.insights.habitLine(
                        habit.completed,
                        habit.decided,
                        percent(habit.rate),
                      )
                    : COPY.insights.habitNoData}
                </p>
                {habit.suggestions.map((suggestion) => (
                  <p className="suggestion" key={suggestion}>
                    {suggestion === "shrink"
                      ? COPY.insights.suggestionShrink
                      : COPY.insights.suggestionReschedule}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel" aria-labelledby="peaks-heading">
        <h2 className="label" id="peaks-heading">
          {COPY.insights.peaksHeading}
        </h2>
        <p className="hint small">{COPY.insights.peaksLede}</p>
        <p className="hint small">
          {settings.peak_windows_enabled === 1
            ? COPY.insights.peaksOn
            : COPY.insights.peaksOff}
        </p>
        {peaks.length === 0 ? (
          <p className="empty">{COPY.insights.peaksEmpty}</p>
        ) : (
          <ul className="peak-list">
            {peaks.map((peak) => (
              <li className="peak-window" key={`${peak.startHour}-${peak.endHour}`}>
                {COPY.insights.peakWindow(
                  hourLabel(peak.startHour),
                  hourLabel(peak.endHour),
                  percent(peak.score),
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="hint small">
          <Link className="link" href="/settings">
            {COPY.insights.settingsLink}
          </Link>
        </p>
      </section>
    </main>
  );
}
