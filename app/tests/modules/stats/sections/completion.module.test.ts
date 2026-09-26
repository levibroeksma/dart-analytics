import { describe, it, expect } from "vitest";
import { completionBuckets } from "@modules/stats/sections/completion.module";
import type { StatsBucketRow } from "@modules/types";

function row(overrides: Partial<StatsBucketRow>): StatsBucketRow {
  return {
    bucketStart: "2026-01-01T00:00:00.000Z",
    bucketEnd: "2026-02-01T00:00:00.000Z",
    statusKey: "COMPLETED",
    contextKey: "STANDALONE",
    rulesetVersionKey: "501_V1",
    neverStarted: false,
    sessions: 1,
    turnSum: 0,
    dartSum: 0,
    durationSum: 0,
    scoreSum: 0,
    scoreMin: 0,
    scoreMax: 0,
    minSessionId: "s1",
    maxSessionId: "s1",
    ...overrides,
  };
}

describe("completionBuckets", () => {
  it("partitions completed, mid-quit and never-started from mixed rows", () => {
    const rows = [
      row({ statusKey: "COMPLETED", sessions: 5 }),
      row({
        statusKey: "ABANDONED",
        neverStarted: false,
        sessions: 2,
        turnSum: 8,
      }),
      row({
        statusKey: "ABANDONED",
        neverStarted: true,
        sessions: 3,
        turnSum: 0,
      }),
    ];

    const [bucket] = completionBuckets(rows, {
      to: "2026-02-01T00:00:00.000Z",
      now: new Date("2026-03-01T00:00:00.000Z"),
    });

    expect(bucket.metrics).toEqual({
      completed: 5,
      abandoned: 2,
      neverStarted: 3,
      abandonedTurns: 8,
    });
    expect(bucket.sampleSize).toBe(10);
  });

  it("sorts buckets by bucket_start ascending", () => {
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

    const buckets = completionBuckets(rows, {
      to: "2026-03-01T00:00:00.000Z",
      now: new Date("2026-04-01T00:00:00.000Z"),
    });

    expect(buckets.map((b) => b.start)).toEqual([
      "2026-01-01T00:00:00.000Z",
      "2026-02-01T00:00:00.000Z",
    ]);
  });

  it("marks a closed bucket per isClosed", () => {
    const rows = [row({})];
    const buckets = completionBuckets(rows, {
      to: "2026-02-01T00:00:00.000Z",
      now: new Date("2026-03-01T00:00:00.000Z"),
    });
    expect(buckets[0].closed).toBe(true);
  });
});
