import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { ScoreTrainingEngine } from "@modules/game/score-training.engine.module";
import { LegacyScoreTrainingEngine } from "./legacy/score-training.legacy";
import { runOracle } from "./support/engine-oracle";
import { scoreTrainingInputs } from "./support/score-training-observations";
import type { ScoreTrainingSnapshot, Seated } from "@lib/types";
import type { ScoreTrainingInput } from "@modules/types";

const SEEDS = Array.from({ length: 15 }, (_, i) => i + 1);

const seat = (n: number, side: string) => ({
  participantRef: `participant-${n}`,
  displayName: `P${n}`,
  sideKey: side,
  participantTypeKey: "PLAYER" as const,
});

const base = (
  n: number,
  over: Partial<ScoreTrainingSnapshot>,
): Seated<ScoreTrainingSnapshot> => ({
  durationType: "ROUNDS",
  durationValue: 6,
  maxDartsPerTurn: 3,
  maxVisitScore: 180,
  ...over,
  seats: Array.from({ length: n }, (_, i) => seat(i + 1, "AB"[i]!)),
});

const CASES: Record<
  string,
  { config: Seated<ScoreTrainingSnapshot>; expireAt?: number }
> = {
  "solo rounds": { config: base(1, {}) },
  "solo minutes, expired": {
    config: base(1, { durationType: "MINUTES", durationValue: 5 }),
    expireAt: 40,
  },
  "duel rounds": { config: base(2, { durationValue: 8 }) },
  "duel rounds, max 60": {
    config: base(2, { durationValue: 8, maxVisitScore: 60 }),
  },
  "solo rounds, max 60": { config: base(1, { maxVisitScore: 60 }) },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Score Training — differential oracle", () => {
  for (const [name, { config, expireAt }] of Object.entries(CASES)) {
    it(`${name}: matches the legacy engine`, () => {
      runOracle<ScoreTrainingInput>({
        build: (prior) => new ScoreTrainingEngine(config, prior),
        legacy: (prior) => new LegacyScoreTrainingEngine(config, prior),
        seeds: SEEDS,
        steps: 120,
        undoRate: 0.1,
        rehydrateEvery: 7,
        expireAt,
        resumeExpired: expireAt !== undefined,
        observe: scoreTrainingInputs(0.3, config),
      });
    });
  }
});
