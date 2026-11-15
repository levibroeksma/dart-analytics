import { describe, expect, it } from "vitest";
import {
  ambiguousDarts,
  poolRows,
  rateOf,
  sumAimRows,
} from "@lib/stats/x01/aim-rows";

const bucket = (metrics: Record<string, Record<string, number>>) => ({
  start: "a",
  end: "b",
  closed: true,
  sampleSize: 1,
  metrics,
});

describe("aim rows", () => {
  it("sums fields across buckets", () => {
    const rows = sumAimRows([
      bucket({ "A|1": { darts: 2, hits: 1 } }),
      bucket({ "A|1": { darts: 3 }, "B|1": { darts: 1 } }),
    ]);
    expect(rows).toEqual({
      "A|1": { darts: 5, hits: 1 },
      "B|1": { darts: 1 },
    });
  });

  it("rateOf is null on a zero denominator", () => {
    expect(rateOf(1, 0)).toBeNull();
    expect(rateOf(1, 4)).toBe(0.25);
  });

  it("reads the ambiguous count, zero when absent", () => {
    expect(ambiguousDarts({ AMBIGUOUS: { darts: 3 } })).toBe(3);
    expect(ambiguousDarts({})).toBe(0);
  });

  it("pools matching rows", () => {
    expect(
      poolRows({ "A|1": { n: 1 }, "A|2": { n: 2 }, "B|1": { n: 9 } }, (k) =>
        k.startsWith("A|"),
      ),
    ).toEqual({ n: 3 });
  });

  it("sums an empty series to no rows and pools nothing when nothing matches", () => {
    expect(sumAimRows([])).toEqual({});
    expect(poolRows({ "A|1": { n: 1 } }, () => false)).toEqual({});
  });
});
