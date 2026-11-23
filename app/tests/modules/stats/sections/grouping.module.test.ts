import { describe, it, expect } from "vitest";
import { groupingBuckets } from "@modules/stats/sections/grouping.module";
import type { IntentMomentRow } from "@modules/types";

function row(overrides: Partial<IntentMomentRow>): IntentMomentRow {
  return {
    bucketStart: "2026-01-01T00:00:00.000Z",
    bucketEnd: "2026-02-01T00:00:00.000Z",
    intendedTargetNumber: 16,
    intendedZoneKey: "DOUBLE",
    n: 1,
    sumX: 0,
    sumY: 0,
    sumXX: 0,
    sumYY: 0,
    sumXY: 0,
    ...overrides,
  };
}

describe("groupingBuckets", () => {
  it("sums moments per target within a bucket", () => {
    const rows = [
      row({ n: 2, sumX: 4, sumY: 6, sumXX: 10, sumYY: 20, sumXY: 5 }),
      row({ n: 3, sumX: -1, sumY: 2, sumXX: 3, sumYY: 4, sumXY: -2 }),
    ];

    const [bucket] = groupingBuckets(rows, {
      to: "2026-02-01T00:00:00.000Z",
      now: new Date("2026-03-01T00:00:00.000Z"),
    });

    expect(bucket.metrics["DOUBLE:16"]).toEqual({
      n: 5,
      sumX: 3,
      sumY: 8,
      sumXX: 13,
      sumYY: 24,
      sumXY: 3,
    });
    expect(bucket.sampleSize).toBe(5);
  });
});

describe("groupingBuckets bucket series", () => {
  const ctx = {
    to: "2026-03-01T00:00:00.000Z",
    now: new Date("2026-02-15T00:00:00.000Z"),
  };

  it("returns an empty series for no rows", () => {
    expect(groupingBuckets([], ctx)).toEqual([]);
  });

  it("orders buckets by start ascending, folds a repeated start, and stamps closure", () => {
    const series = groupingBuckets(
      [
        row({
          bucketStart: "2026-02-01T00:00:00.000Z",
          bucketEnd: "2026-03-01T00:00:00.000Z",
        }),
        row({
          bucketStart: "2026-01-01T00:00:00.000Z",
          bucketEnd: "2026-02-01T00:00:00.000Z",
        }),
        row({
          bucketStart: "2026-02-01T00:00:00.000Z",
          bucketEnd: "2026-03-01T00:00:00.000Z",
        }),
      ],
      ctx,
    );
    expect(
      series.map(({ start, end, closed }) => ({ start, end, closed })),
    ).toEqual([
      {
        start: "2026-01-01T00:00:00.000Z",
        end: "2026-02-01T00:00:00.000Z",
        closed: true,
      },
      {
        start: "2026-02-01T00:00:00.000Z",
        end: "2026-03-01T00:00:00.000Z",
        closed: false,
      },
    ]);
    expect(series[1]!.sampleSize).toBe(2 * series[0]!.sampleSize);
  });
});
