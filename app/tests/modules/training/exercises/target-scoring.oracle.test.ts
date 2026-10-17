import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { TargetScoringEngine } from "@modules/training/exercises/target-scoring.engine.module";
import { LegacyTargetScoringEngine } from "./legacy/target-scoring.legacy";
import { runOracle } from "../../game/support/engine-oracle";
import { aimedOnCurrentTarget } from "../../game/support/aimed-observations";
import type { TargetScoringConfigData } from "@lib/types";

const SEEDS = Array.from({ length: 15 }, (_, i) => i + 1);
const FULL_BOARD = [...Array.from({ length: 20 }, (_, i) => i + 1), 25];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const CASES: [string, TargetScoringConfigData, boolean][] = [
  ["numbers", { targets: [20, 19, 18] }, false],
  ["with bull", { targets: [20, 25] }, false],
  ["single target", { targets: [20] }, false],
  ["bull only", { targets: [25] }, false],
  ["full board, expired", { targets: FULL_BOARD }, true],
];

describe("Target Scoring — kernel vs legacy oracle", () => {
  for (const [name, config, resumeExpired] of CASES) {
    it(`${name}: indistinguishable through every public method`, () => {
      runOracle({
        build: (prior) => new TargetScoringEngine(config, prior),
        legacy: (prior) => new LegacyTargetScoringEngine(config, prior),
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
