import Link from "next/link";
import { CONFIG } from "@/config";
import { COPY } from "@/copy";
import { getDatabase } from "@/db/index";
import { getSettings } from "@/db/settings";
import { saveSettings } from "../actions";

// Settings are read and written through the same data-access functions the tests
// use. Gamification numbers are shown, not edited: they live in src/config.ts.

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const db = getDatabase();
  const settings = getSettings(db);

  return (
    <main className="shell">
      <header className="masthead">
        <div className="masthead-top">
          <h1 className="wordmark">{COPY.settings.heading}</h1>
          <Link className="link" href="/">
            {COPY.nav.home}
          </Link>
        </div>
        <p className="lede">{COPY.settings.intervalHint}</p>
      </header>

      {params.saved ? <p className="notice">{COPY.settings.saved}</p> : null}
      {params.error ? <p className="notice notice-warn">{COPY.settings.error}</p> : null}

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
