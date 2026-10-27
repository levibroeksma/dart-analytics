import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { ScoreThresholdEngine } from "@modules/training/exercises/score-threshold.engine.module";
import { LegacyScoreThresholdEngine } from "./legacy/score-threshold.legacy";
import { runOracle } from "../../game/support/engine-oracle";
import type { ScoreThresholdConfigData } from "@lib/types";

const CONFIG: ScoreThresholdConfigData = { threshold: 65 };
const SEEDS = Array.from({ length: 15 }, (_, i) => i + 1);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const CASES: [string, { steps: number; expireAt?: number }][] = [
  ["expired mid-run", { steps: 240, expireAt: 180 }],
  ["never expired", { steps: 240 }],
];

describe("Score Threshold — kernel vs legacy oracle", () => {
  for (const [name, c] of CASES) {
    it(`${name}: indistinguishable through every public method`, () => {
      runOracle({
        build: (prior) => new ScoreThresholdEngine(CONFIG, prior),
        legacy: (prior) => new LegacyScoreThresholdEngine(CONFIG, prior),
        seeds: SEEDS,
        steps: c.steps,
        undoRate: 0.15,
        rehydrateEvery: 7,
        expireAt: c.expireAt,
        resumeExpired: c.expireAt !== undefined,
      });
    }, 60_000);
  }
});
