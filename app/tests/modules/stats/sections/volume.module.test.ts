import { describe, it, expect } from "vitest";
import { volumeBuckets } from "@modules/stats/sections/volume.module";
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

describe("volumeBuckets", () => {
  it("splits sessions, darts and duration by context", () => {
    const rows = [
      row({
        contextKey: "STANDALONE",
        sessions: 4,
        dartSum: 120,
        durationSum: 1200,
      }),
      row({
        contextKey: "ROUTINE",
        sessions: 1,
        dartSum: 30,
        durationSum: 300,
      }),
    ];

    const [bucket] = volumeBuckets(rows, {
      to: "2026-02-01T00:00:00.000Z",
      now: new Date("2026-03-01T00:00:00.000Z"),
    });

    expect(bucket.metrics).toEqual({
      sessions: { standalone: 4, routine: 1 },
      darts: { standalone: 120, routine: 30 },
      durationSeconds: { standalone: 1200, routine: 300 },
    });
    expect(bucket.sampleSize).toBe(5);
  });
});
