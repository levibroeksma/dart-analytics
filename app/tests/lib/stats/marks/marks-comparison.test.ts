import { describe, expect, it } from "vitest";
import { marksComparison, sumMarks } from "@lib/stats/marks/marks-comparison";
import type { SeriesBucket } from "@lib/types";
import type { MarksMetrics } from "@modules/types";

function metrics(overrides: Partial<MarksMetrics> = {}): MarksMetrics {
  return {
    darts: 9,
    marks: 9,
    wasted: 3,
    rings: { single: 1, double: 1, treble: 2 },
    objectives: [{ key: "20", marks: 3, darts: 2 }],
    closeOuts: { games: 1, darts: 9 },
    duel: { games: 1, wins: 1, darts: 9, points: 60 },
    ...overrides,
  };
}

function bucket(m: MarksMetrics): SeriesBucket<MarksMetrics> {
  return {
    start: "2026-09-01T00:00:00.000Z",
    end: "2026-10-01T00:00:00.000Z",
    closed: true,
    sampleSize: 1,
    metrics: m,
  };
}

describe("sumMarks", () => {
  it("sums every bucket, objectives by key", () => {
    const sum = sumMarks([bucket(metrics()), bucket(metrics())]);
    expect(sum.darts).toBe(18);
    expect(sum.objectives).toEqual([{ key: "20", marks: 6, darts: 4 }]);
    expect(sum.duel.points).toBe(120);
  });

  it("is empty for no buckets", () => {
    expect(sumMarks([]).darts).toBe(0);
    expect(sumMarks([]).objectives).toEqual([]);
  });
});

describe("marksComparison", () => {
  it("builds each measure's ratio from the current and previous metrics", () => {
    const c = marksComparison(metrics(), metrics({ darts: 30, marks: 20 }));
    expect(c.mpr).toEqual({
      current: { part: 27, whole: 9 },
      previous: { part: 60, whole: 30 },
    });
    expect(c.close.current).toEqual({ part: 9, whole: 1 });
    expect(c.wasted.current).toEqual({ part: 3, whole: 9 });
    expect(c.wins.current).toEqual({ part: 1, whole: 1 });
    expect(c.ppr.current).toEqual({ part: 180, whole: 9 });
  });

  it("leaves every previous null with no preceding period", () => {
    const c = marksComparison(metrics(), null);
    expect(
      [c.mpr, c.close, c.wasted, c.wins, c.ppr].map((m) => m.previous),
    ).toEqual([null, null, null, null, null]);
  });
});
