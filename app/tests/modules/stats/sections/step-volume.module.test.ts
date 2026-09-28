import { describe, expect, it } from "vitest";
import { stepVolumeBuckets } from "@modules/stats/sections/step-volume.module";
import type { StepBucketRow } from "@modules/types";

function row(overrides: Partial<StepBucketRow> = {}): StepBucketRow {
  return {
    bucketStart: "2026-01-01T00:00:00.000Z",
    bucketEnd: "2026-02-01T00:00:00.000Z",
    sessions: 1,
    durationSum: 60,
    darts: 3,
    ...overrides,
  };
}

describe("stepVolumeBuckets", () => {
  it("converts one bucket's duration column from seconds to minutes", () => {
    const [bucket] = stepVolumeBuckets(
      [row({ sessions: 4, durationSum: 480, darts: 120 })],
      {
        to: "2026-02-01T00:00:00.000Z",
        now: new Date("2026-03-01T00:00:00.000Z"),
      },
    );

    expect(bucket.metrics).toEqual({ sessions: 4, minutes: 8, darts: 120 });
    expect(bucket.sampleSize).toBe(4);
  });

  it("sorts two buckets chronologically and marks closure independently", () => {
    const rows = [
      row({
        bucketStart: "2026-02-01T00:00:00.000Z",
        bucketEnd: "2026-03-01T00:00:00.000Z",
      }),
      row({
        bucketStart: "2026-01-01T00:00:00.000Z",
        bucketEnd: "2026-02-01T00:00:00.000Z",
      }),
    ];

    const buckets = stepVolumeBuckets(rows, {
      to: "2026-03-01T00:00:00.000Z",
      now: new Date("2026-02-15T00:00:00.000Z"),
    });

    expect(buckets.map((bucket) => bucket.start)).toEqual([
      "2026-01-01T00:00:00.000Z",
      "2026-02-01T00:00:00.000Z",
    ]);
    expect(buckets[0]!.closed).toBe(true);
    expect(buckets[1]!.closed).toBe(false);
  });
});
