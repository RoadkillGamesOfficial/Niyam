import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CONFIG } from "../config.ts";
import {
  heatLevel,
  integrityFromDays,
  levelForXp,
  levelProgress,
  nextMultiplier,
  pulseXp,
  taskXp,
} from "./rules.ts";

describe("combo multiplier", () => {
  it("rises by one step per on-track check-in", () => {
    assert.equal(nextMultiplier(1, "on_track"), 1.25);
    assert.equal(nextMultiplier(1.25, "on_track"), 1.5);
  });

  it("never exceeds the cap", () => {
    assert.equal(nextMultiplier(2.9, "on_track"), CONFIG.game.combo.cap);
    assert.equal(nextMultiplier(3, "on_track"), 3);
  });

  it("is kept on pivot and reset on drift", () => {
    assert.equal(nextMultiplier(2.5, "pivot"), 2.5);
    assert.equal(nextMultiplier(2.5, "drifted"), 1);
  });

  it("does not accumulate floating point noise", () => {
    let multiplier = 1;
    for (let i = 0; i < 8; i += 1) {
      multiplier = nextMultiplier(multiplier, "on_track");
    }
    assert.equal(multiplier, 3);
  });
});

describe("XP amounts", () => {
  it("scales on-track XP by the multiplier", () => {
    assert.equal(pulseXp("on_track", 1), 10);
    assert.equal(pulseXp("on_track", 1.5), 15);
    assert.equal(pulseXp("on_track", 3), 30);
  });

  it("gives flat XP for pivot and for honest drift", () => {
    assert.equal(pulseXp("pivot", 3), 5);
    assert.equal(pulseXp("drifted", 3), 3);
  });

  it("pays per cognitive load", () => {
    assert.equal(taskXp("light"), 15);
    assert.equal(taskXp("medium"), 30);
    assert.equal(taskXp("heavy"), 50);
  });
});

describe("levels", () => {
  it("starts at level 1 with zero XP", () => {
    const level = levelForXp(0);
    assert.equal(level.level, 1);
    assert.equal(level.name, "Mortal");
  });

  it("crosses thresholds exactly", () => {
    assert.equal(levelForXp(119).name, "Mortal");
    assert.equal(levelForXp(120).name, "Initiate");
    assert.equal(levelForXp(700).name, "Legionary");
  });

  it("tops out at the last named level", () => {
    const level = levelForXp(999_999);
    assert.equal(level.level, CONFIG.game.levels.length);
    assert.equal(level.name, "Olympian");
    assert.equal(levelProgress(999_999), 1);
  });

  it("reports progress inside the current level", () => {
    assert.equal(levelProgress(60), 0.5);
    assert.equal(levelProgress(0), 0);
  });
});

describe("system integrity", () => {
  const idle = { answered: 0, missed: 0, tasksDone: 0, tasksPlanned: 0 };

  it("is high after a strong day", () => {
    const score = integrityFromDays([
      { answered: 8, missed: 0, tasksDone: 4, tasksPlanned: 4 },
    ]);
    assert.equal(score, 1);
  });

  it("decays across idle days but never dies", () => {
    const strong = { answered: 8, missed: 0, tasksDone: 4, tasksPlanned: 4 };
    const score = integrityFromDays([strong, idle, idle]);
    assert.ok(score < 1 && score > CONFIG.integrity.floor);
  });

  it("never drops below the floor even after all misses", () => {
    const bad = { answered: 0, missed: 8, tasksDone: 0, tasksPlanned: 4 };
    const score = integrityFromDays([bad, bad, bad]);
    assert.equal(score, CONFIG.integrity.floor);
  });

  it("recovers when engagement returns", () => {
    const strong = { answered: 4, missed: 0, tasksDone: 2, tasksPlanned: 2 };
    const afterIdle = integrityFromDays([strong, idle, idle]);
    const recovered = integrityFromDays([strong, idle, idle, strong]);
    assert.ok(recovered > afterIdle);
  });
});

describe("heat map buckets", () => {
  it("maps activity counts to four levels plus blank", () => {
    assert.equal(heatLevel(0), 0);
    assert.equal(heatLevel(1), 1);
    assert.equal(heatLevel(4), 2);
    assert.equal(heatLevel(7), 3);
    assert.equal(heatLevel(12), 4);
  });
});
