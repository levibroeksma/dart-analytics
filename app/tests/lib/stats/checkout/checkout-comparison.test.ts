import { describe, expect, it } from "vitest";
import { checkoutComparison } from "@lib/stats/checkout/checkout-comparison";

const bucket = <M>(metrics: M) => ({
  start: "a",
  end: "b",
  closed: true,
  sampleSize: 1,
  metrics,
});

const input = (
  targets: Record<string, { attempts: number; successes: number }>,
  maxTarget: number | null,
  afterMiss: number,
  recovered: number,
  busts: Record<string, { visits: number; busts: number }>,
) => ({
  ladder: [bucket({ targets, maxTarget, afterMiss, recovered })],
  busts: [bucket(busts)],
});

describe("checkoutComparison", () => {
  it("sums the four measures and has no previous without a preceding period", () => {
    const c = checkoutComparison(
      input(
        {
          "41": { attempts: 20, successes: 8 },
          "51": { attempts: 10, successes: 2 },
        },
        51,
        18,
        6,
        { "2-40": { visits: 12, busts: 3 } },
      ),
      null,
    );
    expect(c.finish).toEqual({
      current: { part: 10, whole: 30 },
      previous: null,
    });
    expect(c.peak).toEqual({
      current: 51,
      previous: null,
      currentGoes: 30,
      previousGoes: null,
    });
    expect(c.recovery.current).toEqual({ part: 6, whole: 18 });
    expect(c.bust.current).toEqual({ part: 3, whole: 12 });
  });

  it("carries the preceding period's measures", () => {
    const now = input({ "41": { attempts: 30, successes: 15 } }, 61, 0, 0, {});
    const before = input({ "41": { attempts: 31, successes: 12 } }, 51, 5, 1, {
      "41-60": { visits: 10, busts: 1 },
    });
    const c = checkoutComparison(now, before);
    expect(c.finish.previous).toEqual({ part: 12, whole: 31 });
    expect(c.peak.previous).toBe(51);
    expect(c.peak.previousGoes).toBe(31);
    expect(c.recovery.previous).toEqual({ part: 1, whole: 5 });
    expect(c.bust.previous).toEqual({ part: 1, whole: 10 });
  });
});
