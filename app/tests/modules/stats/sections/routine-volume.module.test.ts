import { describe, expect, it } from "vitest";
import { routineVolumeBuckets } from "@modules/stats/sections/routine-volume.module";
import type { RoutineRunBucketRow } from "@modules/types";

function row(
  overrides: Partial<RoutineRunBucketRow> = {},
): RoutineRunBucketRow {
  return {
    bucketStart: "2026-01-01T00:00:00.000Z",
    bucketEnd: "2026-02-01T00:00:00.000Z",
    runs: 1,
    durationSum: 600,
    durationMin: 600,
    durationMax: 600,
    darts: 30,
    completed: 1,
    abandoned: 0,
    neverStarted: 0,
    stepsCompletedAtAbandon: {},
    ...overrides,
  };
}

describe("routineVolumeBuckets", () => {
  it("converts one bucket's duration columns from seconds to minutes", () => {
    const [bucket] = routineVolumeBuckets(
      [
        row({
          runs: 3,
          durationSum: 900,
          durationMin: 120,
          durationMax: 480,
          darts: 90,
        }),
      ],
      {
        to: "2026-02-01T00:00:00.000Z",
        now: new Date("2026-03-01T00:00:00.000Z"),
      },
    );

    expect(bucket.metrics).toEqual({
      runs: 3,
      minutes: 15,
      minMinutes: 2,
      maxMinutes: 8,
      darts: 90,
    });
    expect(bucket.sampleSize).toBe(3);
  });

  it("sorts two buckets chronologically and marks closure independently", () => {
    const rows = [
      row({
        bucketStart: "2026-02-01T00:00:00.000Z",
        bucketEnd: "2026-03-01T00:00:00.000Z",
        runs: 2,
      }),
      row({
        bucketStart: "2026-01-01T00:00:00.000Z",
        bucketEnd: "2026-02-01T00:00:00.000Z",
        runs: 1,
      }),
    ];

    const buckets = routineVolumeBuckets(rows, {
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
