import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TargetScoringEngine } from "@modules/training/exercises/target-scoring.engine.module";
import {
  goldenTrace,
  normalise,
  randomObservation,
} from "../../game/support/engine-oracle";
import { seededUniform } from "@modules/game/seeded-rng.module";

const CONFIGS = {
  numbers: { targets: [20, 19, 18] },
  withBull: { targets: [20, 25] },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Target Scoring — golden", () => {
  for (const [name, config] of Object.entries(CONFIGS)) {
    it(`${name}: seed 42 run is unchanged`, () => {
      const engine = new TargetScoringEngine(config);
      const rand = seededUniform(42, 0);
      for (let i = 0; i < 90; i += 1) {
        if (rand() < 0.1) engine.undo();
        else engine.record(randomObservation(rand));
      }
      engine.expireTimer();
      expect(
        normalise({ facts: engine.facts(), state: engine.state() }),
      ).toMatchSnapshot();
    });
  }
});

describe("Target Scoring — golden trace", () => {
  for (const [name, config] of Object.entries(CONFIGS)) {
    it(`${name}: seed 7 step trace with rehydration is unchanged`, () => {
      expect(
        goldenTrace({
          build: (prior) => new TargetScoringEngine(config, prior),
          seed: 7,
          steps: 260,
          undoRate: 0.1,
          rehydrateEvery: 17,
          expireAt: 200,
        }),
      ).toMatchSnapshot();
    });
  }
});
