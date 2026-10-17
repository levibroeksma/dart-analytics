import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HitCountEngine } from "@modules/training/exercises/hit-count.engine.module";
import { goldenTrace } from "../../game/support/engine-oracle";
import { aimedOnCurrentBoardTarget } from "../../game/support/aimed-observations";
import type { HitCountConfigData } from "@lib/types";

const T = (number: number) => ({ kind: "TREBLE", number }) as const;

const CASES: [string, HitCountConfigData, boolean][] = [
  [
    "big trebles",
    { targets: [T(20), T(19), T(18), T(17)], dartsPerTarget: 9 },
    false,
  ],
  [
    "doubles and bull",
    {
      targets: [{ kind: "DOUBLE", number: 16 }, { kind: "BULL" }],
      dartsPerTarget: 3,
    },
    false,
  ],
  ["one target, expired", { targets: [T(20)], dartsPerTarget: 30 }, true],
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Hit Count — aimed golden trace", () => {
  for (const [name, config, resumeExpired] of CASES) {
    it(`${name}: seed 11 aimed step trace is unchanged`, () => {
      expect(
        goldenTrace({
          build: (prior) => new HitCountEngine(config, prior),
          seed: 11,
          steps: 260,
          undoRate: 0.1,
          rehydrateEvery: 17,
          expireAt: 200,
          resumeExpired,
          observe: aimedOnCurrentBoardTarget(0.6),
        }),
      ).toMatchSnapshot();
    });
  }
});
