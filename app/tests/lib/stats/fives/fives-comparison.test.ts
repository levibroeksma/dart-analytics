import { describe, it, expect } from "vitest";
import { fivesComparison, sumFives } from "@lib/stats/fives/fives-comparison";
import { emptyFivesMetrics } from "@modules/stats/sections/fives.module";

const BUCKET = {
  start: "2026-01-01T00:00:00Z",
  end: "2026-02-01T00:00:00Z",
  closed: true,
  sampleSize: 1,
};

describe("sumFives", () => {
  it("sums every bucket, and is empty with none", () => {
    const m = { ...emptyFivesMetrics(), visits: 3, points: 4 };
    expect(
      sumFives([
        { ...BUCKET, metrics: m },
        { ...BUCKET, metrics: m },
      ]),
    ).toEqual({ ...emptyFivesMetrics(), visits: 6, points: 8 });
    expect(sumFives([])).toEqual(emptyFivesMetrics());
  });

  it("leaves the buckets' metrics unchanged", () => {
    const m = { ...emptyFivesMetrics(), voids: 2 };
    sumFives([
      { ...BUCKET, metrics: m },
      { ...BUCKET, metrics: m },
    ]);
    expect(m).toEqual({ ...emptyFivesMetrics(), voids: 2 });
  });
});

describe("fivesComparison", () => {
  const m = {
    ...emptyFivesMetrics(),
    finished: 4,
    wins: 2,
    visits: 10,
    scoringVisits: 6,
    points: 25,
    winVisits: 9,
  };

  it("reads each measure's part and whole", () => {
    const c = fivesComparison(m, null);
    expect(c.wins.current).toEqual({ part: 2, whole: 4 });
    expect(c.scoringRate.current).toEqual({ part: 6, whole: 10 });
    expect(c.pointsPerVisit.current).toEqual({ part: 25, whole: 10 });
    expect(c.visitsPerWin.current).toEqual({ part: 9, whole: 2 });
    expect(c.wins.previous).toBeNull();
  });

  it("reads the previous period when given", () => {
    expect(fivesComparison(m, m).scoringRate.previous).toEqual({
      part: 6,
      whole: 10,
    });
  });
});
