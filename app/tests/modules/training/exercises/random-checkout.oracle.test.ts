import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { RandomCheckoutEngine } from "@modules/training/exercises/random-checkout.engine.module";
import { LegacyRandomCheckoutEngine } from "./legacy/random-checkout.legacy";
import { runOracle } from "../../game/support/engine-oracle";
import { towardCheckout } from "../../game/support/checkout-observations";
import type { RandomCheckoutConfigData } from "@lib/types";

const SEEDS = Array.from({ length: 15 }, (_, i) => i + 1);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const CASES: [string, { steps: number; expireAt?: number; rate: number }][] = [
  ["random play, expired", { steps: 260, expireAt: 200, rate: 0.3 }],
  ["toward checkout, expired", { steps: 260, expireAt: 200, rate: 0.7 }],
  ["toward checkout, never expired", { steps: 300, rate: 0.85 }],
];

describe("Random Checkout — kernel vs legacy oracle", () => {
  for (const drawSeed of [774, 42]) {
    const config: RandomCheckoutConfigData = {
      minStart: 40,
      maxStart: 170,
      drawSeed,
    };
    for (const [name, c] of CASES) {
      it(`draw seed ${drawSeed}, ${name}: indistinguishable through every public method`, () => {
        runOracle({
          build: (prior) => new RandomCheckoutEngine(config, prior),
          legacy: (prior) => new LegacyRandomCheckoutEngine(config, prior),
          seeds: SEEDS,
          steps: c.steps,
          undoRate: 0.12,
          rehydrateEvery: 19,
          expireAt: c.expireAt,
          resumeExpired: c.expireAt !== undefined,
          observe: towardCheckout(c.rate),
        });
      }, 60_000);
    }
  }
});
