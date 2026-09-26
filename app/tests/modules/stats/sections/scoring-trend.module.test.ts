import { describe, expect, it } from "vitest";
import {
  SCORE_BANDS,
  scoringTrendBuckets,
} from "@modules/stats/sections/scoring-trend.module";
import type { VisitScoringRow } from "@modules/types";

const CTX = {
  to: "2026-02-01T00:00:00.000Z",
  now: new Date("2026-03-01T00:00:00.000Z"),
};

function row(overrides: Partial<VisitScoringRow> = {}): VisitScoringRow {
  return {
    bucketStart: "2026-01-01T00:00:00.000Z",
    bucketEnd: "2026-02-01T00:00:00.000Z",
    points: 45,
    darts: 3,
    firstNinePoints: 45,
    firstNineDarts: 3,
    ton: 0,
    tonForty: 0,
    oneEighty: 0,
    ...overrides,
  };
}

describe("SCORE_BANDS", () => {
  it("is 100/140/180", () => {
    expect(SCORE_BANDS).toEqual([100, 140, 180]);
  });
});

describe("scoringTrendBuckets", () => {
  it("maps a row's fields one-to-one onto the metrics shape", () => {
    const r = row({
      points: 501,
      darts: 45,
      firstNinePoints: 180,
      firstNineDarts: 9,
      ton: 3,
      tonForty: 1,
      oneEighty: 1,
    });

    const [bucket] = scoringTrendBuckets([r], CTX);

    expect(bucket.metrics).toEqual({
      points: 501,
      darts: 45,
      firstNinePoints: 180,
      firstNineDarts: 9,
      bands: { ton: 3, tonForty: 1, oneEighty: 1 },
    });
    expect(bucket.sampleSize).toBe(45);
  });

  it("sums two rows in the same bucket", () => {
    const a = row({ points: 45, darts: 3, ton: 1 });
    const b = row({ points: 60, darts: 3, tonForty: 1 });

    const [bucket] = scoringTrendBuckets([a, b], CTX);

    expect(bucket.metrics).toEqual({
      points: 105,
      darts: 6,
      firstNinePoints: 90,
      firstNineDarts: 6,
      bands: { ton: 1, tonForty: 1, oneEighty: 0 },
    });
  });

  it("splits rows in two buckets", () => {
    const a = row();
    const b = row({
      bucketStart: "2026-02-01T00:00:00.000Z",
      bucketEnd: "2026-03-01T00:00:00.000Z",
    });

    expect(
      scoringTrendBuckets([a, b], {
        to: "2026-03-01T00:00:00.000Z",
        now: new Date("2026-04-01T00:00:00.000Z"),
      }),
    ).toHaveLength(2);
  });
});
