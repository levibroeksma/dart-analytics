import { describe, it, expect } from "vitest";
import {
  groupingBuckets,
  groupingSummary,
} from "@modules/stats/sections/grouping.module";
import { zoneCentroid } from "@lib/game/board/board-geometry.module";
import type { GroupingMoment, IntentMomentRow } from "@modules/types";

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

function momentFromPoints(points: { x: number; y: number }[]): GroupingMoment {
  return points.reduce(
    (acc, p) => ({
      n: acc.n + 1,
      sumX: acc.sumX + p.x,
      sumY: acc.sumY + p.y,
      sumXX: acc.sumXX + p.x * p.x,
      sumYY: acc.sumYY + p.y * p.y,
      sumXY: acc.sumXY + p.x * p.y,
    }),
    { n: 0, sumX: 0, sumY: 0, sumXX: 0, sumYY: 0, sumXY: 0 },
  );
}

describe("groupingSummary", () => {
  const target = { number: 16, zone: "DOUBLE" as const };
  const centroid = zoneCentroid(16, "DOUBLE")!;

  it("computes a zero mean offset and spread=2 for a symmetric cross of four darts", () => {
    const points = [
      { x: centroid.x + 2, y: centroid.y },
      { x: centroid.x - 2, y: centroid.y },
      { x: centroid.x, y: centroid.y + 2 },
      { x: centroid.x, y: centroid.y - 2 },
    ];
    const moment = momentFromPoints(points);

    const summary = groupingSummary(moment, target)!;

    expect(summary.n).toBe(4);
    expect(summary.meanOffset.x).toBeCloseTo(0);
    expect(summary.meanOffset.y).toBeCloseTo(0);
    expect(summary.spreadMm).toBeCloseTo(2);
  });

  it("returns null for n < 2", () => {
    const moment = momentFromPoints([{ x: centroid.x, y: centroid.y }]);
    expect(groupingSummary(moment, target)).toBeNull();
  });

  it("sums additively: two split moments equal the combined moment's summary", () => {
    const points = [
      { x: centroid.x + 2, y: centroid.y },
      { x: centroid.x - 2, y: centroid.y },
      { x: centroid.x, y: centroid.y + 2 },
      { x: centroid.x, y: centroid.y - 2 },
    ];
    const combined = momentFromPoints(points);
    const first = momentFromPoints(points.slice(0, 2));
    const second = momentFromPoints(points.slice(2));
    const summedMoment: GroupingMoment = {
      n: first.n + second.n,
      sumX: first.sumX + second.sumX,
      sumY: first.sumY + second.sumY,
      sumXX: first.sumXX + second.sumXX,
      sumYY: first.sumYY + second.sumYY,
      sumXY: first.sumXY + second.sumXY,
    };

    expect(groupingSummary(summedMoment, target)).toEqual(
      groupingSummary(combined, target),
    );
  });
});

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
