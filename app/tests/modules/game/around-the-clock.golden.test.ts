import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AroundTheClockEngine } from "@modules/game/around-the-clock.engine.module";
import { goldenTrace, normalise } from "./support/engine-oracle";
import { aimedClockObservation } from "./support/clock-observations";
import { seededUniform } from "@modules/game/seeded-rng.module";
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
  over: Partial<AroundTheClockV2Snapshot>,
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

const CONFIGS: Record<
  string,
  { config: AroundTheClockEngineConfig; expireAt?: number }
> = {
  "v1 duo": { config: { seats: seats(2) } },
  "v2 hard outer-single, high-to-low odds-first duo": {
    config: v2(2, {
      pathDirection: "HIGH_TO_LOW",
      oddsFirst: true,
      segmentRule: "OUTER_SINGLE",
      difficulty: "HARD",
    }),
  },
  "v3 lives, odds first": {
    config: {
      ...v2(1, { oddsFirst: true }),
      lives: 3,
    } as AroundTheClockEngineConfig,
  },
  "v2 easy timed solo, expires": {
    config: v2(1, TIMED),
    expireAt: 150,
  },
  "v2 pro timed trio, expires": {
    config: v2(3, { difficulty: "PRO", ...TIMED }),
    expireAt: 200,
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Around the Clock — golden", () => {
  for (const [name, { config, expireAt }] of Object.entries(CONFIGS)) {
    it(`${name}: seed 42 run is unchanged`, () => {
      const engine = new AroundTheClockEngine(config);
      const observe = aimedClockObservation(config);
      const rand = seededUniform(42, 0);
      for (let i = 0; i < 260 && !engine.isComplete(); i += 1) {
        if (i === expireAt) engine.expireTimer();
        else if (rand() < 0.1) engine.undo();
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

describe("Around the Clock — golden trace", () => {
  for (const [name, { config, expireAt }] of Object.entries(CONFIGS)) {
    it(`${name}: seed 7 step trace with rehydration is unchanged`, () => {
      expect(
        goldenTrace({
          build: (prior) => new AroundTheClockEngine(config, prior),
          seed: 7,
          steps: 260,
          undoRate: 0.1,
          rehydrateEvery: 17,
          expireAt,
          resumeExpired: true,
          observe: aimedClockObservation(config),
        }),
      ).toMatchSnapshot();
    });
  }
});
