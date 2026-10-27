import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TuodEngine } from "@modules/game/tuod.engine.module";
import { goldenTrace, normalise } from "./support/engine-oracle";
import { tuodInputs } from "./support/checkout-observations";
import { seededUniform } from "@modules/game/seeded-rng.module";
import type { TuodSnapshot, Seated } from "@lib/types";
import type { TuodInput } from "@modules/types";

const seat = (n: number, side: string) => ({
  participantRef: `participant-${n}`,
  displayName: `P${n}`,
  sideKey: side,
  participantTypeKey: "PLAYER" as const,
});

const config = (
  n: number,
  over: Partial<TuodSnapshot> = {},
): Seated<TuodSnapshot> => ({
  startingTarget: 41,
  finishBonus: 10,
  missPenalty: 1,
  durationType: "ROUNDS",
  durationValue: 6,
  maxDartsPerTurn: 3,
  ...over,
  seats: Array.from({ length: n }, (_, i) => seat(i + 1, "AB"[i]!)),
});

const describeInput = (input: TuodInput): string =>
  "hitZoneKey" in input
    ? `dart ${input.hitZoneKey}/${input.hitTargetNumber}`
    : `total ${JSON.stringify(input)}`;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Ten Up One Down — golden", () => {
  it("duel, 400 mixed steps is unchanged", () => {
    const engine = new TuodEngine(config(2, { durationValue: 25 }));
    const rand = seededUniform(42, 0);
    const observe = tuodInputs(0.25, 0.7);
    for (let step = 0; step < 400; step++) {
      if (rand() < 0.08) engine.undo();
      else {
        try {
          engine.record(observe(rand, engine));
        } catch {
          continue;
        }
      }
    }
    expect(
      normalise({ facts: engine.facts(), state: engine.state() }),
    ).toMatchSnapshot();
  });
});

describe("Ten Up One Down — golden trace", () => {
  const CASES: [string, Seated<TuodSnapshot>, number?][] = [
    ["solo rounds", config(1), undefined],
    ["duel rounds", config(2), undefined],
    [
      "solo, one dart",
      config(1, { maxDartsPerTurn: 1, durationValue: 12 }),
      undefined,
    ],
    ["duel, two darts", config(2, { maxDartsPerTurn: 2 }), undefined],
    [
      "solo, ceiling",
      config(1, { startingTarget: 170, finishBonus: 40, durationValue: 20 }),
      undefined,
    ],
    [
      "solo, floor",
      config(1, { startingTarget: 2, missPenalty: 30, durationValue: 20 }),
      undefined,
    ],
    [
      "solo minutes",
      config(1, { durationType: "MINUTES", durationValue: 10 }),
      150,
    ],
  ];
  for (const [name, cfg, expireAt] of CASES) {
    it(`${name}: seed 7 step trace with rehydration is unchanged`, () => {
      expect(
        goldenTrace<TuodInput>({
          build: (prior) => new TuodEngine(cfg, prior),
          seed: 7,
          steps: 260,
          undoRate: 0.1,
          rehydrateEvery: 17,
          expireAt,
          resumeExpired: expireAt !== undefined,
          observe: tuodInputs(0.25, 0.7),
          describe: describeInput,
        }),
      ).toMatchSnapshot();
    });
  }
});
