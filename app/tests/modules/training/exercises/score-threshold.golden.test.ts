import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ScoreThresholdEngine } from "@modules/training/exercises/score-threshold.engine.module";
import {
  goldenTrace,
  normalise,
  randomObservation,
} from "../../game/support/engine-oracle";
import { seededUniform } from "@modules/game/seeded-rng.module";
import type { ScoreThresholdConfigData } from "@lib/types";

const CONFIG: ScoreThresholdConfigData = { threshold: 65 };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Score Threshold — golden", () => {
  it("seed 42, 300 steps then expiry is unchanged", () => {
    const engine = new ScoreThresholdEngine(CONFIG);
    const rand = seededUniform(42, 0);
    for (let step = 0; step < 300; step++) {
      if (rand() < 0.08) engine.undo();
      else engine.record(randomObservation(rand));
    }
    engine.expireTimer();
    expect(
      normalise({ facts: engine.facts(), state: engine.state() }),
    ).toMatchSnapshot();
  });

  it("seed 7 step trace with rehydration is unchanged", () => {
    expect(
      goldenTrace({
        build: (prior) => new ScoreThresholdEngine(CONFIG, prior),
        seed: 7,
        steps: 240,
        undoRate: 0.1,
        rehydrateEvery: 7,
        expireAt: 180,
        resumeExpired: true,
      }),
    ).toMatchSnapshot();
  });
});
