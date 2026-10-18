import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DoublesLockEngine } from "@modules/training/exercises/doubles-lock.engine.module";
import { goldenTrace } from "../../game/support/engine-oracle";
import { aimedOnCurrentBoardTarget } from "../../game/support/aimed-observations";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Doubles Lock — aimed golden trace", () => {
  for (const resumeExpired of [false, true]) {
    it(`resumeExpired ${resumeExpired}: seed 13 aimed step trace is unchanged`, () => {
      expect(
        goldenTrace({
          build: (prior) => new DoublesLockEngine({}, prior),
          seed: 13,
          steps: 260,
          undoRate: 0.1,
          rehydrateEvery: 17,
          expireAt: 200,
          resumeExpired,
          observe: aimedOnCurrentBoardTarget(
            0.7,
            "currentDouble",
            () => "DOUBLE",
          ),
        }),
      ).toMatchSnapshot();
    });
  }
});
