import { describe, expect, it } from "vitest";
import {
  averageBand,
  checkoutBand,
  percentile,
} from "../../scripts/dartbot-level-select-stats";

describe("percentile", () => {
  it("interpolates linearly between order statistics", () => {
    const sorted = [1, 2, 3, 4, 5];
    expect(percentile(sorted, 0.25)).toBeCloseTo(2, 5);
    expect(percentile(sorted, 0.5)).toBeCloseTo(3, 5);
    expect(percentile(sorted, 0.75)).toBeCloseTo(4, 5);
  });

  it("returns the single value for a one-element array at any p", () => {
    expect(percentile([42], 0.1)).toBe(42);
    expect(percentile([42], 0.9)).toBe(42);
  });
});

describe("averageBand", () => {
  it("returns the rounded 25th/75th percentile of visit totals", () => {
    const visitTotals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(averageBand(visitTotals)).toEqual({ low: 3, high: 8 });
  });

  it("does not mutate the input array", () => {
    const visitTotals = [5, 1, 3, 2, 4];
    const copy = [...visitTotals];
    averageBand(visitTotals);
    expect(visitTotals).toEqual(copy);
  });
});

describe("checkoutBand", () => {
  it("returns the rounded 25th/75th percentile of per-batch checkout rate, as 0..100", () => {
    // 4 batches of 2: [T,F]=0.5, [T,T]=1.0, [F,F]=0.0, [T,F]=0.5
    const outcomes = [true, false, true, true, false, false, true, false];
    expect(checkoutBand(outcomes, 4)).toEqual({ low: 38, high: 63 });
  });
});
