import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { OneTwentyOneEngine } from "@modules/game/one-twenty-one.engine.module";
import { LegacyOneTwentyOneEngine } from "./legacy/one-twenty-one.legacy";
import { runOracle } from "./support/engine-oracle";
import { oneTwentyOneInputs } from "./support/checkout-observations";
import type {
  OneTwentyOneSnapshot,
  OneTwentyOneV2Snapshot,
  RulesetVersionKey,
  Seated,
} from "@lib/types";
import type { OneTwentyOneInput } from "@modules/types";

const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);

const seat = (n: number, side: string) => ({
  participantRef: `participant-${n}`,
  displayName: `P${n}`,
  sideKey: side,
  participantTypeKey: "PLAYER" as const,
});
const seats = (n: number) =>
  Array.from({ length: n }, (_, i) => seat(i + 1, "AB"[i]!));

type Config = Seated<OneTwentyOneSnapshot> | Seated<OneTwentyOneV2Snapshot>;

const v1 = (n: number): Config => ({ seats: seats(n) });
const v2 = (
  n: number,
  over: Pick<OneTwentyOneV2Snapshot, "durationType" | "durationValue">,
): Config => ({ ...over, seats: seats(n) }) as Config;

const CASES: Record<
  string,
  {
    config: Config;
    key: RulesetVersionKey;
    steps: number;
    expireAt?: number;
  }
> = {
  "v1 solo, target": { config: v1(1), key: "121_V1", steps: 500 },
  "v1 duel, race": { config: v1(2), key: "121_V1", steps: 700 },
  "v2 solo rounds": {
    config: v2(1, { durationType: "ROUNDS", durationValue: 6 }),
    key: "121_V2",
    steps: 300,
  },
  "v2 duel rounds": {
    config: v2(2, { durationType: "ROUNDS", durationValue: 5 }),
    key: "121_V2",
    steps: 400,
  },
  "v2 solo minutes, expired": {
    config: v2(1, { durationType: "MINUTES", durationValue: 10 }),
    key: "121_V2",
    steps: 300,
    expireAt: 200,
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("121 — kernel vs legacy oracle", () => {
  for (const [name, c] of Object.entries(CASES)) {
    for (const [mix, visitRate, towardRate, checkoutRate] of [
      ["boards and keypad", 0.25, 0.7, 0.6],
      ["boards mostly", 0.04, 0.85, 0.5],
    ] as const) {
      it(`${name}, ${mix}: indistinguishable through every public method`, () => {
        runOracle<OneTwentyOneInput>({
          build: (prior) => new OneTwentyOneEngine(c.config, prior, c.key),
          legacy: (prior) =>
            new LegacyOneTwentyOneEngine(c.config, prior, c.key),
          seeds: SEEDS,
          steps: c.steps,
          undoRate: 0.12,
          rehydrateEvery: 13,
          expireAt: c.expireAt,
          resumeExpired: c.expireAt !== undefined,
          observe: oneTwentyOneInputs(visitRate, towardRate, checkoutRate),
        });
      }, 60_000);
    }
  }
});
