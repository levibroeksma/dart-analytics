import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { AroundTheClockEngine } from "@modules/game/around-the-clock.engine.module";
import { LegacyAroundTheClockEngine } from "./legacy/around-the-clock.legacy";
import { runOracle } from "./support/engine-oracle";
import { aimedClockObservation } from "./support/clock-observations";
import type {
  AroundTheClockEngineConfig,
  AroundTheClockV2Snapshot,
  Seated,
} from "@lib/types";

const seat = (n: number, side: string) => ({
  participantRef: `participant-${n}`,
  displayName: `P${n}`,
  sideKey: side,
  participantTypeKey: "PLAYER" as const,
});
const seats = (n: number) =>
  Array.from({ length: n }, (_, i) => seat(i + 1, "ABC"[i]!));
const v2 = (
  n: number,
  over: Partial<AroundTheClockV2Snapshot> = {},
): Seated<AroundTheClockV2Snapshot> => ({
  pathDirection: "LOW_TO_HIGH",
  oddsFirst: false,
  segmentRule: "ANY",
  difficulty: "EASY",
  durationType: "UNTIMED",
  durationValue: null,
  ...over,
  seats: seats(n),
});
const TIMED = { durationType: "MINUTES", durationValue: 10 } as const;
const SEEDS = Array.from({ length: 15 }, (_, i) => i + 1);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const CASES: [string, AroundTheClockEngineConfig, number?][] = [
  ["v1 solo", { seats: seats(1) }],
  ["v1 duo", { seats: seats(2) }],
  [
    "v2 intermediate outer-single trio",
    v2(3, { difficulty: "INTERMEDIATE", segmentRule: "OUTER_SINGLE" }),
  ],
  [
    "v2 hard duo, high-to-low odds-first",
    v2(2, {
      difficulty: "HARD",
      pathDirection: "HIGH_TO_LOW",
      oddsFirst: true,
    }),
  ],
  ["v2 pro solo", v2(1, { difficulty: "PRO" })],
  ["v2 easy timed duo, expires", v2(2, TIMED), 140],
  [
    "v2 hard outer-single timed trio, expires",
    v2(3, { difficulty: "HARD", segmentRule: "OUTER_SINGLE", ...TIMED }),
    180,
  ],
];

describe("Around the Clock — kernel vs legacy oracle", () => {
  for (const [name, cfg, expireAt] of CASES) {
    it(`${name}: indistinguishable through every public method`, () => {
      runOracle({
        build: (prior) => new AroundTheClockEngine(cfg, prior),
        legacy: (prior) => new LegacyAroundTheClockEngine(cfg, prior),
        seeds: SEEDS,
        steps: 260,
        undoRate: 0.12,
        rehydrateEvery: 19,
        expireAt,
        resumeExpired: true,
        observe: aimedClockObservation(cfg),
      });
    }, 60_000);
  }
});
