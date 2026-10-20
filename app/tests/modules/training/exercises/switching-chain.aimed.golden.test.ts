import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SwitchingChainEngine } from "@modules/training/exercises/switching-chain.engine.module";
import { goldenTrace } from "../../game/support/engine-oracle";
import { aimedOnCurrentTarget } from "../../game/support/aimed-observations";
import type { SwitchingChainConfigData } from "@lib/types";

const CASES: [string, SwitchingChainConfigData, boolean][] = [
  ["numbers", { targets: [20, 19, 18] }, false],
  ["bull last", { targets: [20, 19, 25] }, false],
  ["bull first", { targets: [25, 1, 20] }, false],
  ["expired, resumed", { targets: [3, 17, 25] }, true],
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Switching Chain — aimed golden trace", () => {
  for (const [name, config, resumeExpired] of CASES) {
    it(`${name}: seed 11 aimed step trace is unchanged`, () => {
      expect(
        goldenTrace({
          build: (prior) => new SwitchingChainEngine(config, prior),
          seed: 11,
          steps: 260,
          undoRate: 0.1,
          rehydrateEvery: 17,
          expireAt: 200,
          resumeExpired,
          observe: aimedOnCurrentTarget(0.6),
        }),
      ).toMatchSnapshot();
    });
  }
});
