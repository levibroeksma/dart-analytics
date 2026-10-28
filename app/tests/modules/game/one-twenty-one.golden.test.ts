import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OneTwentyOneEngine } from "@modules/game/one-twenty-one.engine.module";
import { goldenTrace } from "./support/engine-oracle";
import { oneTwentyOneInputs } from "./support/checkout-observations";
import type {
  OneTwentyOneSnapshot,
  OneTwentyOneV2Snapshot,
  RulesetVersionKey,
  Seated,
} from "@lib/types";
import type { OneTwentyOneInput } from "@modules/types";

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

const describeInput = (input: OneTwentyOneInput): string =>
  "hitZoneKey" in input
    ? `${input.hitZoneKey}/${input.hitTargetNumber}`
    : `visit ${input.scoreAttempted}/${input.finishedOnDouble}`;

type Case = {
  config: Config;
  key: RulesetVersionKey;
  steps: number;
  observe: ReturnType<typeof oneTwentyOneInputs>;
  expireAt?: number;
};

const CASES: Record<string, Case> = {
  "v1 solo to the cap": {
    config: v1(1),
    key: "121_V1",
    steps: 400,
    observe: oneTwentyOneInputs(0.35, 0.9, 0.9),
  },
  "v1 duel race": {
    config: v1(2),
    key: "121_V1",
    steps: 700,
    observe: oneTwentyOneInputs(0.35, 0.9, 0.9),
  },
  "v2 solo rounds": {
    config: v2(1, { durationType: "ROUNDS", durationValue: 6 }),
    key: "121_V2",
    steps: 260,
    observe: oneTwentyOneInputs(0.25, 0.7, 0.6),
  },
  "v2 duel rounds": {
    config: v2(2, { durationType: "ROUNDS", durationValue: 5 }),
    key: "121_V2",
    steps: 260,
    observe: oneTwentyOneInputs(0.25, 0.7, 0.6),
  },
  "v2 solo minutes": {
    config: v2(1, { durationType: "MINUTES", durationValue: 10 }),
    key: "121_V2",
    steps: 200,
    observe: oneTwentyOneInputs(0.25, 0.7, 0.6),
    expireAt: 150,
  },
  "v1 solo boards only, final-visit close": {
    config: v1(1),
    key: "121_V1",
    steps: 260,
    observe: oneTwentyOneInputs(0, 0.6, 0),
  },
  "v1 solo keypad only, busts and guards": {
    config: v1(1),
    key: "121_V1",
    steps: 200,
    observe: oneTwentyOneInputs(1, 0, 0.3),
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("121 — golden trace", () => {
  for (const [name, c] of Object.entries(CASES)) {
    it(`${name}: seed 7 step trace with rehydration is unchanged`, () => {
      expect(
        goldenTrace<OneTwentyOneInput>({
          build: (prior) => new OneTwentyOneEngine(c.config, prior, c.key),
          seed: 7,
          steps: c.steps,
          undoRate: 0.1,
          rehydrateEvery: 17,
          expireAt: c.expireAt,
          resumeExpired: c.expireAt !== undefined,
          observe: c.observe,
          describe: describeInput,
        }),
      ).toMatchSnapshot();
    });
  }
});
