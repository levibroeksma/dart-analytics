import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RandomCheckoutEngine } from "@modules/training/exercises/random-checkout.engine.module";
import { goldenTrace, normalise } from "../../game/support/engine-oracle";
import { towardCheckout } from "../../game/support/checkout-observations";
import { seededUniform } from "@modules/game/seeded-rng.module";
import type { RandomCheckoutConfigData } from "@lib/types";

const config = (drawSeed: number): RandomCheckoutConfigData => ({
  minStart: 40,
  maxStart: 170,
  drawSeed,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Random Checkout — golden", () => {
  it("draw seed 42, 300 steps then expiry is unchanged", () => {
    const engine = new RandomCheckoutEngine(config(42));
    const rand = seededUniform(42, 0);
    const observe = towardCheckout(0.75);
    for (let step = 0; step < 300; step++) {
      if (rand() < 0.08) engine.undo();
      else engine.record(observe(rand, engine));
    }
    engine.expireTimer();
    expect(
      normalise({ facts: engine.facts(), state: engine.state() }),
    ).toMatchSnapshot();
  });
});

describe("Random Checkout — golden trace", () => {
  for (const drawSeed of [774, 42]) {
    it(`draw seed ${drawSeed}: seed 7 step trace with rehydration is unchanged`, () => {
      expect(
        goldenTrace({
          build: (prior) => new RandomCheckoutEngine(config(drawSeed), prior),
          seed: 7,
          steps: 260,
          undoRate: 0.1,
          rehydrateEvery: 17,
          expireAt: 200,
          resumeExpired: true,
          observe: towardCheckout(0.75),
        }),
      ).toMatchSnapshot();
    });
  }
});
