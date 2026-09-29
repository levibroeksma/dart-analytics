import { describe, expect, it } from "vitest";
import { routineCompletionBuckets } from "@modules/stats/sections/routine-completion.module";
import type { RoutineRunBucketRow } from "@modules/types";

function row(
  overrides: Partial<RoutineRunBucketRow> = {},
): RoutineRunBucketRow {
  return {
    bucketStart: "2026-01-01T00:00:00.000Z",
    bucketEnd: "2026-02-01T00:00:00.000Z",
    runs: 1,
    durationSum: 0,
    durationMin: 0,
    durationMax: 0,
    darts: 0,
    completed: 1,
    abandoned: 0,
    neverStarted: 0,
    stepsCompletedAtAbandon: {},
    ...overrides,
  };
}

describe("routineCompletionBuckets", () => {
  it("partitions one bucket's runs into completed, abandoned and never-started", () => {
    const [bucket] = routineCompletionBuckets(
      [
        row({
          runs: 5,
          completed: 2,
          abandoned: 2,
          neverStarted: 1,
          stepsCompletedAtAbandon: { "1": 1, "2": 1 },
        }),
      ],
      {
        to: "2026-02-01T00:00:00.000Z",
        now: new Date("2026-03-01T00:00:00.000Z"),
      },
    );

    expect(bucket.metrics).toEqual({
      completed: 2,
      abandoned: 2,
      neverStarted: 1,
      stepsCompletedAtAbandon: { "1": 1, "2": 1 },
    });
    expect(bucket.sampleSize).toBe(5);
  });

  it("sorts two buckets chronologically", () => {
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

    const buckets = routineCompletionBuckets(rows, {
      to: "2026-03-01T00:00:00.000Z",
      now: new Date("2026-03-01T00:00:00.000Z"),
    });

    expect(buckets.map((bucket) => bucket.start)).toEqual([
      "2026-01-01T00:00:00.000Z",
      "2026-02-01T00:00:00.000Z",
    ]);
  });
});
