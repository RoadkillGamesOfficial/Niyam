import { CONFIG } from "@/config";
import { COPY } from "@/copy";
import type { PlayerState } from "@/db/player";
import { HeartIcon, StarIcon } from "./sprites";

const XP_SEGMENTS = 12;

/** Three intentionally different gauges: a badge, a medallion, an energy meter. */
export function StatsHud({
  player,
  todayXp,
  celebrate = false,
}: {
  player: PlayerState;
  todayXp: number;
  celebrate?: boolean;
}) {
  const xpFilled = Math.round(Math.min(1, Math.max(0, player.progress)) * XP_SEGMENTS);
  const integrity = Math.round(player.integrity * 100);
  const comboPips = Math.min(
    4,
    Math.max(0, Math.round((player.multiplier - CONFIG.game.combo.start) / CONFIG.game.combo.step)),
  );
  const lowIntegrity = player.integrity < 0.4;

  return (
    <section className={`hud${celebrate ? " hud-celebrate" : ""}`} aria-label={COPY.progress.hudLabel}>
      <div className="gauge gauge-level">
        <div className="gauge-heading">
          <StarIcon className="gauge-icon" />
          <span className="gauge-label">{COPY.progress.levelLabel}</span>
          <span className="gauge-level-number">
            {COPY.progress.levelShort} {player.level.level}
          </span>
        </div>
        <p className="gauge-title">{player.level.name}</p>
        <div
          className="xp-segments"
          role="img"
          aria-label={`${Math.round(player.progress * 100)}% ${COPY.progress.toNext}`}
        >
          {Array.from({ length: XP_SEGMENTS }, (_, index) => (
            <span className={`xp-segment${index < xpFilled ? " is-filled" : ""}`} key={index} />
          ))}
        </div>
        <p className="gauge-caption">
          {player.totalXp} {COPY.progress.xpLabel} · {COPY.progress.todayXp(todayXp)}
        </p>
      </div>

      <div className="gauge gauge-combo">
        <div className="combo-medallion">
          <span className="combo-coin-edge" aria-hidden="true" />
          <span className="combo-value">×{player.multiplier}</span>
        </div>
        <div className="combo-copy">
          <span className="gauge-label">{COPY.progress.comboLabel}</span>
          <span className="combo-pips" aria-hidden="true">
            {Array.from({ length: 4 }, (_, index) => (
              <span className={`combo-pip${index < comboPips ? " is-lit" : ""}`} key={index} />
            ))}
          </span>
          <p className="gauge-caption">{COPY.checkin.missedHelper}</p>
        </div>
      </div>

      <div className={`gauge gauge-integrity${lowIntegrity ? " is-low" : ""}`}>
        <div className="gauge-heading">
          <HeartIcon className="gauge-icon gauge-icon-heart" />
          <span className="gauge-label">{COPY.progress.integrityLabel}</span>
          <span className="integrity-number">{integrity}%</span>
        </div>
        <div
          className="energy-meter"
          role="img"
          aria-label={`${COPY.progress.integrityLabel} ${integrity}%`}
        >
          {Array.from({ length: 10 }, (_, index) => (
            <span className={`energy-pip${index < Math.round(integrity / 10) ? " is-filled" : ""}`} key={index} />
          ))}
        </div>
        <p className="gauge-caption">{COPY.progress.integrityHint}</p>
      </div>
    </section>
  );
}
