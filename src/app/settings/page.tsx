import { CONFIG } from "@/config";
import { COPY } from "@/copy";
import { getBackupStatus } from "@/db/backup";
import { databasePath } from "@/db/database";
import { getDatabase } from "@/db/index";
import { getSettings } from "@/db/settings";
import { localDateString } from "@/time";
import { checkLocalModel, saveAiSettings } from "../ai-actions";
import { backupNow, saveInsightSettings, saveSettings } from "../actions";
import { SiteHeader } from "../ui/site-header";

// Settings are read and written through the same data-access functions the tests
// use. Gamification numbers are shown, not edited: they live in src/config.ts.

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    error?: string;
    ai?: string;
    aiError?: string;
    backedUp?: string;
    backupError?: string;
  }>;
}) {
  const params = await searchParams;
  const db = getDatabase();
  const settings = getSettings(db);
  const backup = getBackupStatus(databasePath());

  return (
    <main className="shell">
      <SiteHeader
        active="settings"
        title={COPY.settings.heading}
        lede={COPY.settings.intervalHint}
        date={localDateString()}
      />

      {params.saved ? <p className="notice">{COPY.settings.saved}</p> : null}
      {params.error ? <p className="notice notice-warn">{COPY.settings.error}</p> : null}
      {params.aiError ? (
        <p className="notice notice-warn">{COPY.ai.modelError}</p>
      ) : null}
      {params.ai === "ok" ? <p className="notice">{COPY.ai.ok}</p> : null}
      {params.ai === "down" ? (
        <p className="notice notice-warn">{COPY.ai.down}</p>
      ) : null}
      {params.backedUp ? <p className="notice">{COPY.settings.backedUp}</p> : null}
      {params.backupError ? (
        <p className="notice notice-warn">{COPY.settings.backupError}</p>
      ) : null}

      <section className="panel" aria-labelledby="data-settings">
        <h2 className="label" id="data-settings">
          {COPY.settings.dataHeading}
        </h2>
        <p className="hint small">{COPY.settings.dataLede}</p>
        <div className="inline-form" style={{ marginTop: 12 }}>
          <a className="button" href="/export" download>
            {COPY.settings.exportButton}
          </a>
          <form action={backupNow}>
            <button className="button button-quiet" type="submit">
              {COPY.settings.backupNow}
            </button>
          </form>
        </div>
        <p className="hint small">{COPY.settings.exportHint}</p>
        <p className="label" style={{ marginTop: 16 }}>
          {COPY.settings.backupHeading}
        </p>
        <p className="hint small">
          {COPY.settings.backupLede(backup.count, backup.intervalHours)}
        </p>
        {backup.latestName ? (
          <p className="hint small">{COPY.settings.backupLatest(backup.latestName)}</p>
        ) : (
          <p className="hint small">{COPY.settings.backupEmpty}</p>
        )}
        <p className="hint small">
          {COPY.settings.backupPolicy(backup.retain, backup.intervalHours)}
        </p>
      </section>

      <section className="panel" aria-labelledby="checkin-settings">
        <h2 className="label" id="checkin-settings">
          {COPY.checkin.heading}
        </h2>
        <form className="settings-form" action={saveSettings}>
          <label className="field">
            <span>{COPY.settings.interval}</span>
            <input
              type="number"
              name="intervalMinutes"
              min={5}
              max={240}
              defaultValue={settings.checkin_interval_minutes}
              required
            />
          </label>

          <label className="field">
            <span>{COPY.settings.level}</span>
            <select name="interruptionLevel" defaultValue={settings.interruption_level}>
              <option value="gentle">{COPY.settings.levels.gentle}</option>
              <option value="standard">{COPY.settings.levels.standard}</option>
              <option value="firm">{COPY.settings.levels.firm}</option>
            </select>
          </label>

          <div className="field-row">
            <label className="field">
              <span>{COPY.settings.quietFrom}</span>
              <input type="time" name="quietStart" defaultValue={settings.quiet_start ?? ""} />
            </label>
            <label className="field">
              <span>{COPY.settings.quietTo}</span>
              <input type="time" name="quietEnd" defaultValue={settings.quiet_end ?? ""} />
            </label>
          </div>
          <p className="hint small">{COPY.settings.quietHint}</p>

          <button className="button" type="submit">
            {COPY.settings.save}
          </button>
        </form>
      </section>

      <section className="panel ai-panel" aria-labelledby="ai-settings">
        <h2 className="label" id="ai-settings">
          {COPY.ai.heading}
        </h2>
        <p className="hint small">{COPY.ai.lead}</p>
        <form className="settings-form" action={saveAiSettings} style={{ marginTop: 12 }}>
          <label className="field">
            <span>
              <input type="checkbox" name="enabled" defaultChecked={settings.ai_enabled === 1} />{" "}
              {COPY.ai.enabled}
            </span>
          </label>
          <label className="field">
            <span>{COPY.ai.model}</span>
            <input
              type="text"
              name="model"
              defaultValue={settings.ai_model}
              maxLength={80}
            />
          </label>
          <p className="hint small">{COPY.ai.modelHint}</p>
          <button className="button" type="submit">
            {COPY.settings.save}
          </button>
        </form>
        <form action={checkLocalModel} style={{ marginTop: 12 }}>
          <button className="button button-quiet" type="submit">
            {COPY.ai.check}
          </button>
        </form>
      </section>

      <section className="panel" aria-labelledby="insight-settings">
        <h2 className="label" id="insight-settings">
          {COPY.insights.settingsHeading}
        </h2>
        <p className="hint small">{COPY.insights.settingsLede}</p>
        <form className="settings-form" action={saveInsightSettings} style={{ marginTop: 12 }}>
          <label className="field">
            <span>
              <input
                type="checkbox"
                name="peakWindowsEnabled"
                defaultChecked={settings.peak_windows_enabled === 1}
              />{" "}
              {COPY.insights.peakToggle}
            </span>
          </label>
          <p className="hint small">{COPY.insights.peakHint}</p>
          <button className="button" type="submit">
            {COPY.settings.save}
          </button>
        </form>
      </section>

      <section className="panel" aria-labelledby="game-values">
        <h2 className="label" id="game-values">
          {COPY.settings.gameHeading}
        </h2>
        <p className="hint small">{COPY.settings.gameNote}</p>
        <dl className="values">
          <dt>{COPY.settings.gameValues.onTrack}</dt>
          <dd>{CONFIG.game.xp.onTrack}</dd>
          <dt>{COPY.settings.gameValues.pivot}</dt>
          <dd>{CONFIG.game.xp.pivot}</dd>
          <dt>{COPY.settings.gameValues.drifted}</dt>
          <dd>{CONFIG.game.xp.drifted}</dd>
          <dt>{COPY.settings.gameValues.micro}</dt>
          <dd>{CONFIG.game.xp.microAction}</dd>
          <dt>{COPY.settings.gameValues.light}</dt>
          <dd>{CONFIG.game.xp.taskByLoad.light}</dd>
          <dt>{COPY.settings.gameValues.medium}</dt>
          <dd>{CONFIG.game.xp.taskByLoad.medium}</dd>
          <dt>{COPY.settings.gameValues.heavy}</dt>
          <dd>{CONFIG.game.xp.taskByLoad.heavy}</dd>
          <dt>{COPY.settings.gameValues.closed}</dt>
          <dd>{CONFIG.game.xp.dayClosed}</dd>
          <dt>{COPY.settings.gameValues.comboStep}</dt>
          <dd>{CONFIG.game.combo.step}</dd>
          <dt>{COPY.settings.gameValues.comboCap}</dt>
          <dd>{CONFIG.game.combo.cap}</dd>
        </dl>
      </section>
    </main>
  );
}
