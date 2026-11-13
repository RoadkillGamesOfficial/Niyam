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
 *
 * Detection and animation are separate effects. React's development StrictMode
 * runs an effect, cleans it up and runs it again; keeping the class names on
 * state-driven effects means the first animation is re-applied rather than
 * cancelled after the second detection pass.
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
  const [comboGain, setComboGain] = useState(false);

  // Detection writes state and the last-seen values, but has no cleanup that
  // could undo the state when StrictMode replays the effect.
  useEffect(() => {
    if (completedTaskId && rewardXp > 0) {
      const seenKey = `niyam.reward.${completedTaskId}`;
      if (sessionStorage.getItem(seenKey) === null) {
        sessionStorage.setItem(seenKey, "1");
        setXpFloat(rewardXp);
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
        setFreshStart(false);
        setComboGain(true);
      } else if (multiplier < previousCombo - 0.001) {
        setComboGain(false);
        setFreshStart(true);
      }
    }
    try {
      localStorage.setItem(COMBO_KEY, String(multiplier));
    } catch {
      // See above.
    }
  }, [completedTaskId, rewardXp, level, multiplier]);

  useEffect(() => {
    if (xpFloat === null) return;
    const root = document.documentElement;
    root.classList.add("xp-gain");
    const timer = window.setTimeout(() => {
      setXpFloat(null);
      root.classList.remove("xp-gain");
    }, 1900);
    return () => {
      window.clearTimeout(timer);
      root.classList.remove("xp-gain");
    };
  }, [xpFloat]);

  useEffect(() => {
    if (!levelUp) return;
    const timer = window.setTimeout(() => setLevelUp(false), 5200);
    return () => window.clearTimeout(timer);
  }, [levelUp]);

  useEffect(() => {
    if (!freshStart) return;
    const root = document.documentElement;
    root.classList.add("combo-reset");
    const timer = window.setTimeout(() => {
      setFreshStart(false);
      root.classList.remove("combo-reset");
    }, 2200);
    return () => {
      window.clearTimeout(timer);
      root.classList.remove("combo-reset");
    };
  }, [freshStart]);

  useEffect(() => {
    if (!comboGain) return;
    const root = document.documentElement;
    root.classList.add("combo-gain");
    const timer = window.setTimeout(() => {
      setComboGain(false);
      root.classList.remove("combo-gain");
    }, 900);
    return () => {
      window.clearTimeout(timer);
      root.classList.remove("combo-gain");
    };
  }, [comboGain]);

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
