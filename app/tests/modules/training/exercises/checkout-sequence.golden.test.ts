import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CheckoutSequenceEngine } from "@modules/training/exercises/checkout-sequence.engine.module";
import { goldenTrace, normalise } from "../../game/support/engine-oracle";
import { towardCheckout } from "../../game/support/checkout-observations";
import { seededUniform } from "@modules/game/seeded-rng.module";
import type { CheckoutSequenceConfigData } from "@lib/types";

const CONFIG: CheckoutSequenceConfigData = {
  firstOutshot: 61,
  lastOutshot: 100,
  dartLimit: 6,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Checkout Sequence — golden", () => {
  it("seed 42 run to completion is unchanged", () => {
    const engine = new CheckoutSequenceEngine(CONFIG);
    const rand = seededUniform(42, 0);
    const observe = towardCheckout(0.85);
    while (!engine.isComplete()) {
      if (rand() < 0.08) engine.undo();
      else engine.record(observe(rand, engine));
    }
    expect(
      normalise({ facts: engine.facts(), state: engine.state() }),
    ).toMatchSnapshot();
  });
});

describe("Checkout Sequence — golden trace", () => {
  for (const [name, expireAt] of [
    ["expired", 200],
    ["to completion", undefined],
  ] as const) {
    it(`${name}: seed 7 step trace with rehydration is unchanged`, () => {
      expect(
        goldenTrace({
          build: (prior) => new CheckoutSequenceEngine(CONFIG, prior),
          seed: 7,
          steps: expireAt ? 260 : 420,
          undoRate: 0.1,
          rehydrateEvery: 17,
          expireAt,
          resumeExpired: expireAt !== undefined,
          observe: towardCheckout(0.8),
        }),
      ).toMatchSnapshot();
    });
  }
});
