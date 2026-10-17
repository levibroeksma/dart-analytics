import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SinglesTrainingEngine } from "@modules/game/singles-training.engine.module";
import { goldenTrace, normalise } from "./support/engine-oracle";
import { aimedSinglesObservation } from "./support/singles-observations";
import { seededUniform } from "@modules/game/seeded-rng.module";
import type {
  RulesetVersionKey,
  Seated,
  SinglesSnapshot,
  SinglesV2Snapshot,
  SinglesV3Snapshot,
} from "@lib/types";

const seat = (n: number, side: string) => ({
  participantRef: `participant-${n}`,
  displayName: `P${n}`,
  sideKey: side,
  participantTypeKey: "PLAYER" as const,
});
const seats = (n: number) =>
  Array.from({ length: n }, (_, i) => seat(i + 1, "ABC"[i]!));
const ASCENDING = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
];
const POINTS = { pointsSingle: 1, pointsDouble: 2, pointsTreble: 3 };

const CONFIGS: Record<
  string,
  {
    key: RulesetVersionKey;
    config:
      | Seated<SinglesSnapshot>
      | Seated<SinglesV2Snapshot>
      | Seated<SinglesV3Snapshot>;
  }
> = {
  "v1 duo": {
    key: "SINGLES_V1",
    config: {
      orderMode: "LOW_TO_HIGH",
      targetOrder: ASCENDING,
      difficulty: "EASY",
      ...POINTS,
      seats: seats(2),
    },
  },
  "v2 hard duo": {
    key: "SINGLES_V2",
    config: {
      orderMode: "LOW_TO_HIGH",
      targetOrder: ASCENDING,
      difficulty: "HARD",
      ...POINTS,
      seats: seats(2),
    },
  },
  "v3 accuracy extreme trio": {
    key: "SINGLES_V3",
    config: {
      orderMode: "LOW_TO_HIGH",
      targetOrder: ASCENDING,
      difficulty: "EXTREME",
      scoringMode: "ACCURACY",
      ...POINTS,
      seats: seats(3),
    },
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Singles Training — golden", () => {
  for (const [name, { key, config }] of Object.entries(CONFIGS)) {
    it(`${name}: seed 42 run is unchanged`, () => {
      const engine = new SinglesTrainingEngine(config, undefined, key);
      const observe = aimedSinglesObservation(config);
      const rand = seededUniform(42, 0);
      for (let i = 0; i < 200 && !engine.isComplete(); i += 1) {
        if (rand() < 0.1) engine.undo();
        else engine.record(observe(rand, engine));
      }
      expect(
        normalise({
          key: engine.rulesetVersionKey,
          facts: engine.facts(),
          state: engine.state(),
        }),
      ).toMatchSnapshot();
    });
  }
});

describe("Singles Training — golden trace", () => {
  for (const [name, { key, config }] of Object.entries(CONFIGS)) {
    it(`${name}: seed 7 step trace with rehydration is unchanged`, () => {
      expect(
        goldenTrace({
          build: (prior) => new SinglesTrainingEngine(config, prior, key),
          seed: 7,
          steps: 260,
          undoRate: 0.1,
          rehydrateEvery: 17,
          observe: aimedSinglesObservation(config),
        }),
      ).toMatchSnapshot();
    });
  }
});
