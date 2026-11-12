"use client";

import { useEffect, useState } from "react";
import { COPY } from "@/copy";

const LEVEL_KEY = "niyam.seenLevel";
const COMBO_KEY = "niyam.seenCombo";

/**
 * Small, visual-only reward feedback. The XP shown is the configured XP for the
 * task that was just completed; no scoring happens here. Level and combo changes
 * are detected only to animate the existing values, and are cleared under the
 * reduced-motion media query.
 */
export function RewardWatcher({
  completedTaskId,
  rewardXp,
  level,
  levelName,
  multiplier,
}: {
  completedTaskId: number | null;
  rewardXp: number;
  level: number;
  levelName: string;
  multiplier: number;
}) {
  const [xpFloat, setXpFloat] = useState<number | null>(null);
  const [levelUp, setLevelUp] = useState(false);
  const [freshStart, setFreshStart] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const timers: number[] = [];
    const later = (fn: () => void, delay: number): void => {
      timers.push(window.setTimeout(fn, delay));
    };

    if (completedTaskId && rewardXp > 0) {
      const seenKey = `niyam.reward.${completedTaskId}`;
      if (sessionStorage.getItem(seenKey) === null) {
        sessionStorage.setItem(seenKey, "1");
        setXpFloat(rewardXp);
        root.classList.add("xp-gain");
        later(() => {
          setXpFloat(null);
          root.classList.remove("xp-gain");
        }, 1900);
      }
    }

    let previousLevel: number | null = null;
    try {
      const stored = localStorage.getItem(LEVEL_KEY);
      previousLevel = stored === null ? null : Number(stored);
    } catch {
      previousLevel = null;
    }
    if (previousLevel !== null && level > previousLevel) {
      setLevelUp(true);
      later(() => setLevelUp(false), 5200);
    }
    try {
      localStorage.setItem(LEVEL_KEY, String(level));
    } catch {
      // Storage is a nicety; a blocked one must never affect the page.
    }

    let previousCombo: number | null = null;
    try {
      const stored = localStorage.getItem(COMBO_KEY);
      previousCombo = stored === null ? null : Number(stored);
    } catch {
      previousCombo = null;
    }
    if (previousCombo !== null && Number.isFinite(previousCombo)) {
      if (multiplier > previousCombo + 0.001) {
        root.classList.add("combo-gain");
        later(() => root.classList.remove("combo-gain"), 900);
      } else if (multiplier < previousCombo - 0.001) {
        setFreshStart(true);
        root.classList.add("combo-reset");
        later(() => {
          setFreshStart(false);
          root.classList.remove("combo-reset");
        }, 2200);
      }
    }
    try {
      localStorage.setItem(COMBO_KEY, String(multiplier));
    } catch {
      // See above.
    }

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      root.classList.remove("xp-gain", "combo-gain", "combo-reset");
    };
  }, [completedTaskId, rewardXp, level, multiplier]);

  return (
    <>
      {xpFloat !== null ? (
        <p className="xp-float" role="status">
          {COPY.rewards.xp(xpFloat)}
        </p>
      ) : null}

      {freshStart ? (
        <p className="fresh-start" role="status">
          {COPY.rewards.freshStart}
        </p>
      ) : null}

      {levelUp ? (
        <div className="level-up" role="status" aria-live="polite">
          <span className="level-up-stars" aria-hidden="true">
            ✦ ✧ ✦ ✧ ✦
          </span>
          <p className="level-up-title">{COPY.rewards.levelUp}</p>
          <p className="level-up-body">{COPY.rewards.levelUpBody(levelName)}</p>
          <button className="button level-up-dismiss" type="button" onClick={() => setLevelUp(false)}>
            {COPY.rewards.dismiss}
          </button>
        </div>
      ) : null}
    </>
  );
}
