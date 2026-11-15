import { describe, expect, it } from "vitest";
import {
  bestLegOf,
  bustRate,
  checkoutRate,
  dartsPerLeg,
  pointDelta,
} from "@lib/stats/x01/summaries";

const bucket = <M>(metrics: M) => ({
  start: "2026-09-01T00:00:00.000Z",
  end: "2026-09-02T00:00:00.000Z",
  closed: true,
  sampleSize: 1,
  metrics,
});

describe("checkoutRate", () => {
  it("sums finished over chances across remaining keys", () => {
    const rate = checkoutRate([
      bucket({
        "40": { chances: 4, finished: 1 },
        "32": { chances: 6, finished: 2 },
      }),
    ]);
    expect(rate).toEqual({ numerator: 3, denominator: 10, rate: 0.3 });
  });

  it("has a null rate with no chances", () => {
    expect(checkoutRate([])).toEqual({
      numerator: 0,
      denominator: 0,
      rate: null,
    });
  });
});

describe("bustRate", () => {
  it("divides busts by visits", () => {
    expect(bustRate([bucket({ "60": { visits: 20, busts: 3 } })]).rate).toBe(
      0.15,
    );
  });
});

describe("dartsPerLeg", () => {
  it("weights the darts-per-leg histogram by leg count", () => {
    expect(
      dartsPerLeg([bucket({ legs: { "15": 2, "18": 1 }, bestLeg: null })]),
    ).toBe(16);
  });

  it("is null for an empty histogram", () => {
    expect(dartsPerLeg([bucket({ legs: {}, bestLeg: null })])).toBeNull();
  });
});

describe("bestLegOf", () => {
  it("picks the fewest darts across buckets", () => {
    const best = bestLegOf([
      bucket({ legs: {}, bestLeg: { darts: 21, sessionId: "a" } }),
      bucket({ legs: {}, bestLeg: { darts: 15, sessionId: "b" } }),
    ]);
    expect(best).toEqual({ darts: 15, sessionId: "b" });
  });

  it("keeps the first of a tie", () => {
    const best = bestLegOf([
      bucket({ legs: {}, bestLeg: { darts: 15, sessionId: "a" } }),
      bucket({ legs: {}, bestLeg: { darts: 15, sessionId: "b" } }),
    ]);
    expect(best?.sessionId).toBe("a");
  });

  it("is null when no bucket has a best leg", () => {
    expect(bestLegOf([bucket({ legs: {}, bestLeg: null })])).toBeNull();
  });
});

describe("pointDelta", () => {
  const rate = (value: number | null) => ({
    numerator: 0,
    denominator: 0,
    rate: value,
  });

  it("is the change in percentage points", () => {
    expect(pointDelta(rate(0.3), rate(0.25))).toBeCloseTo(5, 9);
  });

  it("is null without a previous period or a rate", () => {
    expect(pointDelta(rate(0.3), null)).toBeNull();
    expect(pointDelta(rate(null), rate(0.25))).toBeNull();
    expect(pointDelta(rate(0.3), rate(null))).toBeNull();
  });
});
