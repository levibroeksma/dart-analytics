import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { SinglesTrainingEngine } from "@modules/game/singles-training.engine.module";
import { LegacySinglesTrainingEngine } from "./legacy/singles-training.legacy";
import { runOracle } from "./support/engine-oracle";
import { aimedSinglesObservation } from "./support/singles-observations";
import type {
  RulesetVersionKey,
  Seated,
  SinglesV2Snapshot,
  SinglesV3Snapshot,
} from "@lib/types";

const seat = (n: number, side: string) => ({
  participantRef: `participant-${n}`,
  displayName: `P${n}`,
  sideKey: side,
  participantTypeKey: "PLAYER" as const,
});
const ASCENDING = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
];
const DESCENDING = [
  20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 25,
];
const seated = (n: number) =>
  Array.from({ length: n }, (_, i) => seat(i + 1, "ABC"[i]!));
const v2 = (
  seats: number,
  over: Partial<SinglesV2Snapshot> = {},
): Seated<SinglesV2Snapshot> => ({
  orderMode: "LOW_TO_HIGH",
  targetOrder: ASCENDING,
  difficulty: "EASY",
  pointsSingle: 1,
  pointsDouble: 2,
  pointsTreble: 3,
  ...over,
  seats: seated(seats),
});
const v3 = (
  seats: number,
  over: Partial<SinglesV3Snapshot>,
): Seated<SinglesV3Snapshot> => ({
  ...v2(seats),
  scoringMode: "STANDARD",
  ...over,
});
const SEEDS = Array.from({ length: 15 }, (_, i) => i + 1);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const CASES: [
  string,
  RulesetVersionKey,
  Seated<SinglesV2Snapshot> | Seated<SinglesV3Snapshot>,
][] = [
  ["v1 solo", "SINGLES_V1", v2(1)],
  ["v1 duo", "SINGLES_V1", v2(2)],
  ["v1 trio", "SINGLES_V1", v2(3)],
  ["v2 hard duo", "SINGLES_V2", v2(2, { difficulty: "HARD" })],
  ["v2 extreme trio", "SINGLES_V2", v2(3, { difficulty: "EXTREME" })],
  [
    "v3 accuracy hard duo",
    "SINGLES_V3",
    v3(2, { difficulty: "HARD", scoringMode: "ACCURACY" }),
  ],
  [
    "v3 standard extreme solo, descending, 2/5/9",
    "SINGLES_V3",
    v3(1, {
      orderMode: "HIGH_TO_LOW",
      targetOrder: DESCENDING,
      difficulty: "EXTREME",
      pointsSingle: 2,
      pointsDouble: 5,
      pointsTreble: 9,
    }),
  ],
];

describe("Singles Training — kernel vs legacy oracle", () => {
  for (const [name, key, cfg] of CASES) {
    it(`${name}: indistinguishable through every public method`, () => {
      runOracle({
        build: (prior) => new SinglesTrainingEngine(cfg, prior, key),
        legacy: (prior) => new LegacySinglesTrainingEngine(cfg, prior, key),
        seeds: SEEDS,
        steps: 260,
        undoRate: 0.12,
        rehydrateEvery: 19,
        observe: aimedSinglesObservation(cfg),
      });
    }, 60_000);
  }
});
