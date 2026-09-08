import { describe, expect, it } from "vitest";
import {
  isCheckoutReachable,
  minimumCheckoutDarts,
} from "@modules/game/checkout-reachability.module";

describe("minimumCheckoutDarts", () => {
  it("returns 1 for every single-dart double or BULL finish", () => {
    expect(minimumCheckoutDarts(40)).toBe(1); // D20
    expect(minimumCheckoutDarts(2)).toBe(1); // D1
    expect(minimumCheckoutDarts(50)).toBe(1); // BULL
  });

  it("returns 2 for the classic 100 finish (T20, D20)", () => {
    expect(minimumCheckoutDarts(100)).toBe(2);
  });

  it("returns 3 for the maximum checkout, 170 (T20, T20, BULL)", () => {
    expect(minimumCheckoutDarts(170)).toBe(3);
  });

  it("finds a true 2-dart BULL finish shorter than the display chart's 3-dart route (#247 follow-up)", () => {
    // checkout-path.module.ts's hint chart lists these as 3-dart routes
    // (e.g. 101 -> T17, 10, D20) because it shows the conventional finish,
    // not the shortest one. T17 + BULL = 51 + 50 = 101 is 2 darts and legal.
    expect(minimumCheckoutDarts(101)).toBe(2); // T17, BULL
    expect(minimumCheckoutDarts(104)).toBe(2); // T18, BULL
    expect(minimumCheckoutDarts(107)).toBe(2); // T19, BULL
    expect(minimumCheckoutDarts(110)).toBe(2); // T20, BULL
  });

  it("returns null for every bogey number", () => {
    for (const bogey of [169, 168, 166, 165, 163, 162, 159, 1]) {
      expect(minimumCheckoutDarts(bogey)).toBeNull();
    }
  });

  it("returns null for 0, above 170, negatives, and non-integers", () => {
    expect(minimumCheckoutDarts(0)).toBeNull();
    expect(minimumCheckoutDarts(171)).toBeNull();
    expect(minimumCheckoutDarts(-5)).toBeNull();
    expect(minimumCheckoutDarts(40.5)).toBeNull();
  });

  it("every non-bogey score from 2-170 resolves to 1, 2, or 3 darts", () => {
    const bogeys = new Set([169, 168, 166, 165, 163, 162, 159, 1]);
    for (let score = 2; score <= 170; score++) {
      if (bogeys.has(score)) continue;
      expect([1, 2, 3]).toContain(minimumCheckoutDarts(score));
    }
  });
});

describe("isCheckoutReachable", () => {
  it("is true when the true minimum exactly matches darts available", () => {
    expect(isCheckoutReachable(121, 3)).toBe(true); // T20, T11, D14
  });

  it("is true with slack darts to spare", () => {
    expect(isCheckoutReachable(25, 3)).toBe(true); // 9, D8 = 2 darts, 3 available
  });

  it("is false when fewer darts remain than any legal route needs", () => {
    expect(isCheckoutReachable(25, 1)).toBe(false); // needs 2, only 1 left
  });

  it("is true for a single-dart double with exactly 1 dart left", () => {
    expect(isCheckoutReachable(40, 1)).toBe(true); // D20
  });

  it("is true for 50 with exactly 1 dart left via BULL, even though the display chart's route needs 2 (#247)", () => {
    expect(isCheckoutReachable(50, 1)).toBe(true);
  });

  it("is true for 101/104/107/110 with exactly 2 darts left via a treble + BULL, even though the display chart's route needs 3", () => {
    expect(isCheckoutReachable(101, 2)).toBe(true);
    expect(isCheckoutReachable(104, 2)).toBe(true);
    expect(isCheckoutReachable(107, 2)).toBe(true);
    expect(isCheckoutReachable(110, 2)).toBe(true);
  });

  it("is false for every bogey number regardless of darts available", () => {
    for (const bogey of [169, 168, 166, 165, 163, 162, 159, 1]) {
      expect(isCheckoutReachable(bogey, 3)).toBe(false);
    }
  });

  it("is false when no darts remain", () => {
    expect(isCheckoutReachable(40, 0)).toBe(false);
  });
});
