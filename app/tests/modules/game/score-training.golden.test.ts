import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ScoreTrainingEngine } from "@modules/game/score-training.engine.module";
import { goldenTrace, normalise } from "./support/engine-oracle";
import { scoreTrainingInputs } from "./support/score-training-observations";
import { seededUniform } from "@modules/game/seeded-rng.module";
import type { ScoreTrainingSnapshot, Seated } from "@lib/types";
import type { ScoreTrainingInput } from "@modules/types";

/*
 * Recorded on the hand-written engine before its rebind onto the visit
 * points kernel. One accepted divergence is outside these traces: a stored
 * turn with `completedAt` set and fewer than three darts reads open on the
 * hand-written fold and closed on the kernel's dart count. The live engine
 * never writes one.
 */

const seat = (n: number, side: string) => ({
  participantRef: `participant-${n}`,
  displayName: `P${n}`,
  sideKey: side,
  participantTypeKey: "PLAYER" as const,
});

const config = (
  n: number,
  over: Partial<ScoreTrainingSnapshot> = {},
): Seated<ScoreTrainingSnapshot> => ({
  durationType: "ROUNDS",
  durationValue: 6,
  maxDartsPerTurn: 3,
  maxVisitScore: 180,
  ...over,
  seats: Array.from({ length: n }, (_, i) => seat(i + 1, "AB"[i]!)),
});

const describeInput = (input: ScoreTrainingInput): string =>
  typeof input === "number"
    ? `total ${input}`
    : `dart ${input.hitZoneKey}/${input.hitTargetNumber}`;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Score Training — golden", () => {
  it("duel, 400 mixed steps is unchanged", () => {
    const cfg = config(2, { durationValue: 25 });
    const engine = new ScoreTrainingEngine(cfg);
    const rand = seededUniform(42, 0);
    const observe = scoreTrainingInputs(0.3, cfg);
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

describe("Score Training — golden trace", () => {
  const CASES: [string, Seated<ScoreTrainingSnapshot>, number?][] = [
    ["solo rounds", config(1), undefined],
    [
      "solo minutes",
      config(1, { durationType: "MINUTES", durationValue: 5 }),
      40,
    ],
    ["duel rounds", config(2, { durationValue: 8 }), undefined],
    [
      "duel rounds, max 60",
      config(2, { durationValue: 8, maxVisitScore: 60 }),
      undefined,
    ],
  ];
  for (const [name, cfg, expireAt] of CASES) {
    it(`${name}: seed 7 step trace with rehydration is unchanged`, () => {
      expect(
        goldenTrace<ScoreTrainingInput>({
          build: (prior) => new ScoreTrainingEngine(cfg, prior),
          seed: 7,
          steps: 160,
          undoRate: 0.1,
          rehydrateEvery: 7,
          expireAt,
          resumeExpired: expireAt !== undefined,
          observe: scoreTrainingInputs(0.3, cfg),
          describe: describeInput,
        }),
      ).toMatchSnapshot();
    });
  }
});
