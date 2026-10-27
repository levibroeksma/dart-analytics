import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { CheckoutSequenceEngine } from "@modules/training/exercises/checkout-sequence.engine.module";
import { LegacyCheckoutSequenceEngine } from "./legacy/checkout-sequence.legacy";
import { runOracle } from "../../game/support/engine-oracle";
import { towardCheckout } from "../../game/support/checkout-observations";
import type { CheckoutSequenceConfigData } from "@lib/types";

const CONFIG: CheckoutSequenceConfigData = {
  firstOutshot: 61,
  lastOutshot: 100,
  dartLimit: 6,
};
const SEEDS = Array.from({ length: 15 }, (_, i) => i + 1);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const CASES: [string, { steps: number; expireAt?: number; rate: number }][] = [
  ["random play, expired", { steps: 260, expireAt: 200, rate: 0.3 }],
  ["toward checkout, expired", { steps: 260, expireAt: 200, rate: 0.7 }],
  ["long run to completion", { steps: 420, rate: 0.9 }],
];

describe("Checkout Sequence — kernel vs legacy oracle", () => {
  for (const [name, c] of CASES) {
    it(`${name}: indistinguishable through every public method`, () => {
      runOracle({
        build: (prior) => new CheckoutSequenceEngine(CONFIG, prior),
        legacy: (prior) => new LegacyCheckoutSequenceEngine(CONFIG, prior),
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
});
