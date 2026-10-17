import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { SwitchingTargetScoringEngine } from "@modules/training/exercises/switching-target-scoring.engine.module";
import { LegacySwitchingTargetScoringEngine } from "./legacy/switching-target-scoring.legacy";
import { runOracle } from "../../game/support/engine-oracle";
import { aimedOnCurrentTarget } from "../../game/support/aimed-observations";
import type { SwitchingTargetScoringConfigData } from "@lib/types";

const SEEDS = Array.from({ length: 15 }, (_, i) => i + 1);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const CASES: [string, SwitchingTargetScoringConfigData, boolean][] = [
  ["numbers", { targets: [20, 19, 18] }, false],
  ["bull last", { targets: [20, 19, 25] }, false],
  ["bull first", { targets: [25, 1, 20] }, false],
  ["bull middle", { targets: [6, 25, 11] }, false],
  ["expired, resumed", { targets: [3, 17, 25] }, true],
];

describe("Switching Target Scoring — kernel vs legacy oracle", () => {
  for (const [name, config, resumeExpired] of CASES) {
    it(`${name}: indistinguishable through every public method`, () => {
      runOracle({
        build: (prior) => new SwitchingTargetScoringEngine(config, prior),
        legacy: (prior) =>
          new LegacySwitchingTargetScoringEngine(config, prior),
        seeds: SEEDS,
        steps: 260,
        undoRate: 0.12,
        rehydrateEvery: 19,
        expireAt: 200,
        resumeExpired,
        observe: aimedOnCurrentTarget(0.6),
      });
    }, 60_000);
  }
});
