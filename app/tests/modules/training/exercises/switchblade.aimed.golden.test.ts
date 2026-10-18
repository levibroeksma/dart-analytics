import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SwitchbladeEngine } from "@modules/training/exercises/switchblade.engine.module";
import { goldenTrace } from "../../game/support/engine-oracle";
import { aimedOnCurrentBoardTarget } from "../../game/support/aimed-observations";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("SwitchBlade — aimed golden trace", () => {
  for (const resumeExpired of [false, true]) {
    it(`resumeExpired ${resumeExpired}: seed 11 aimed step trace is unchanged`, () => {
      expect(
        goldenTrace({
          build: (prior) => new SwitchbladeEngine({}, prior),
          seed: 11,
          steps: 260,
          undoRate: 0.1,
          rehydrateEvery: 17,
          expireAt: 200,
          resumeExpired,
          observe: aimedOnCurrentBoardTarget(0.6, "currentSlot"),
        }),
      ).toMatchSnapshot();
    });
  }
});
