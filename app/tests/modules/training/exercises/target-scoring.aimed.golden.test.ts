import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TargetScoringEngine } from "@modules/training/exercises/target-scoring.engine.module";
import { goldenTrace } from "../../game/support/engine-oracle";
import { aimedOnCurrentTarget } from "../../game/support/aimed-observations";
import type { TargetScoringConfigData } from "@lib/types";

const FULL_BOARD = [...Array.from({ length: 20 }, (_, i) => i + 1), 25];

const CASES: [string, TargetScoringConfigData, boolean][] = [
  ["numbers", { targets: [20, 19, 18] }, false],
  ["bull first", { targets: [25, 20] }, false],
  ["single target", { targets: [20] }, false],
  ["full board, expired", { targets: FULL_BOARD }, true],
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Target Scoring — aimed golden trace", () => {
  for (const [name, config, resumeExpired] of CASES) {
    it(`${name}: seed 11 aimed step trace is unchanged`, () => {
      expect(
        goldenTrace({
          build: (prior) => new TargetScoringEngine(config, prior),
          seed: 11,
          steps: 260,
          undoRate: 0.1,
          rehydrateEvery: 17,
          expireAt: 200,
          resumeExpired,
          observe: aimedOnCurrentTarget(0.6),
        }),
      ).toMatchSnapshot();
    });
  }
});
