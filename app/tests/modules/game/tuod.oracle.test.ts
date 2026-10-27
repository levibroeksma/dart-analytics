import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { TuodEngine } from "@modules/game/tuod.engine.module";
import { LegacyTuodEngine } from "./legacy/tuod.legacy";
import { runOracle } from "./support/engine-oracle";
import { tuodInputs } from "./support/checkout-observations";
import type { TuodSnapshot, Seated } from "@lib/types";
import type { TuodInput } from "@modules/types";

const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);

const seat = (n: number, side: string) => ({
  participantRef: `participant-${n}`,
  displayName: `P${n}`,
  sideKey: side,
  participantTypeKey: "PLAYER" as const,
});
const seats = (n: number) =>
  Array.from({ length: n }, (_, i) => seat(i + 1, "AB"[i]!));

const base = (
  n: number,
  over: Partial<TuodSnapshot>,
): Seated<TuodSnapshot> => ({
  startingTarget: 41,
  finishBonus: 10,
  missPenalty: 1,
  durationType: "ROUNDS",
  durationValue: 6,
  maxDartsPerTurn: 3,
  ...over,
  seats: seats(n),
});

const CASES: Record<
  string,
  { config: Seated<TuodSnapshot>; steps: number; expireAt?: number }
> = {
  "solo rounds": { config: base(1, {}), steps: 260 },
  "duel rounds": { config: base(2, {}), steps: 320 },
  "duel rounds, two darts": {
    config: base(2, { maxDartsPerTurn: 2 }),
    steps: 320,
  },
  "solo rounds, one dart": {
    config: base(1, { maxDartsPerTurn: 1, durationValue: 12 }),
    steps: 260,
  },
  "solo, climbs past the ceiling": {
    config: base(1, {
      startingTarget: 170,
      finishBonus: 40,
      durationValue: 20,
    }),
    steps: 300,
  },
  "solo, falls past the floor": {
    config: base(1, { startingTarget: 2, missPenalty: 30, durationValue: 20 }),
    steps: 300,
  },
  "solo minutes, expired": {
    config: base(1, { durationType: "MINUTES", durationValue: 10 }),
    steps: 260,
    expireAt: 180,
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Ten Up One Down — kernel vs legacy oracle", () => {
  for (const [name, c] of Object.entries(CASES)) {
    for (const [mix, visitRate, towardRate] of [
      ["boards and keypad", 0.25, 0.6],
      ["boards mostly", 0.04, 0.8],
    ] as const) {
      it(`${name}, ${mix}: indistinguishable through every public method`, () => {
        runOracle<TuodInput>({
          build: (prior) => new TuodEngine(c.config, prior),
          legacy: (prior) => new LegacyTuodEngine(c.config, prior),
          seeds: SEEDS,
          steps: c.steps,
          undoRate: 0.12,
          rehydrateEvery: 19,
          expireAt: c.expireAt,
          resumeExpired: c.expireAt !== undefined,
          observe: tuodInputs(visitRate, towardRate),
        });
      }, 60_000);
    }
  }
});
