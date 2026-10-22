import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SnakesLaddersEngine } from "@modules/training/exercises/snakes-ladders.engine.module";
import { goldenTrace } from "../../game/support/engine-oracle";
import { aimedOnCurrentBoardTarget } from "../../game/support/aimed-observations";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Doubles Snakes & Ladders — aimed golden trace", () => {
  for (const resumeExpired of [false, true]) {
    it(`resumeExpired ${resumeExpired}: seed 17 aimed step trace is unchanged`, () => {
      expect(
        goldenTrace({
          build: (prior) => new SnakesLaddersEngine({}, prior),
          seed: 17,
          steps: 260,
          undoRate: 0.1,
          rehydrateEvery: 17,
          expireAt: 200,
          resumeExpired,
          observe: aimedOnCurrentBoardTarget(0.6, "currentLevel"),
        }),
      ).toMatchSnapshot();
    });
  }
});
