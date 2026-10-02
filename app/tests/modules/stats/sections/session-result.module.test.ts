import { describe, it, expect } from "vitest";
import { sessionResultBuckets } from "@modules/stats/sections/session-result.module";
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
    turnSum: 10,
    dartSum: 30,
    durationSum: 300,
    scoreSum: 500,
    scoreMin: 500,
    scoreMax: 500,
    minSessionId: "s1",
    maxSessionId: "s1",
    bestAvgSessionId: "s1",
    bestAvgPoints: 500,
    bestAvgDarts: 30,
    bestAvgCompletedAt: "2026-01-15T10:00:00.000Z",
    ...overrides,
  };
}

describe("sessionResultBuckets", () => {
  it("keys metrics by ruleset version", () => {
    const rows = [
      row({ rulesetVersionKey: "501_V1" }),
      row({ rulesetVersionKey: "TUOD_V1" }),
    ];

    const [bucket] = sessionResultBuckets(rows, {
      to: "2026-02-01T00:00:00.000Z",
      now: new Date("2026-03-01T00:00:00.000Z"),
    });

    expect(Object.keys(bucket.metrics).sort()).toEqual(["501_V1", "TUOD_V1"]);
  });

  it("picks the correct min/max session ids across two groups, never averaging", () => {
    const rows = [
      row({
        contextKey: "STANDALONE",
        sessions: 1,
        scoreSum: 400,
        scoreMin: 400,
        scoreMax: 400,
        minSessionId: "low",
        maxSessionId: "low",
      }),
      row({
        contextKey: "ROUTINE",
        sessions: 1,
        scoreSum: 600,
        scoreMin: 600,
        scoreMax: 600,
        minSessionId: "high",
        maxSessionId: "high",
      }),
    ];

    const [bucket] = sessionResultBuckets(rows, {
      to: "2026-02-01T00:00:00.000Z",
      now: new Date("2026-03-01T00:00:00.000Z"),
    });

    const metrics = bucket.metrics["501_V1"];
    expect(metrics.sessions).toBe(2);
    expect(metrics.countedScoreSum).toBe(1000);
    expect(metrics.countedScoreMin).toBe(400);
    expect(metrics.bestLowSessionId).toBe("low");
    expect(metrics.countedScoreMax).toBe(600);
    expect(metrics.bestHighSessionId).toBe("high");
  });
});

describe("sessionResultBuckets bestAverage", () => {
  const ctx = {
    to: "2026-02-01T00:00:00.000Z",
    now: new Date("2026-03-01T00:00:00.000Z"),
  };

  it("carries the group's best per-session average as a points/darts pair with its date", () => {
    const [bucket] = sessionResultBuckets(
      [
        row({
          bestAvgSessionId: "pb",
          bestAvgPoints: 540,
          bestAvgDarts: 27,
          bestAvgCompletedAt: "2026-01-15T10:00:00.000Z",
        }),
      ],
      ctx,
    );
    expect(bucket.metrics["501_V1"].bestAverage).toEqual({
      sessionId: "pb",
      points: 540,
      darts: 27,
      completedAt: "2026-01-15T10:00:00.000Z",
    });
  });

  it("is null when no session in the group has darts", () => {
    const [bucket] = sessionResultBuckets(
      [
        row({
          bestAvgSessionId: null,
          bestAvgPoints: null,
          bestAvgDarts: null,
          bestAvgCompletedAt: null,
        }),
      ],
      ctx,
    );
    expect(bucket.metrics["501_V1"].bestAverage).toBeNull();
  });

  it("merging two groups keeps the higher ratio, not the higher total", () => {
    const [bucket] = sessionResultBuckets(
      [
        row({
          contextKey: "STANDALONE",
          bestAvgSessionId: "long",
          bestAvgPoints: 900,
          bestAvgDarts: 60,
          bestAvgCompletedAt: "2026-01-10T10:00:00.000Z",
        }),
        row({
          contextKey: "ROUTINE",
          bestAvgSessionId: "short",
          bestAvgPoints: 300,
          bestAvgDarts: 15,
          bestAvgCompletedAt: "2026-01-20T10:00:00.000Z",
        }),
      ],
      ctx,
    );
    expect(bucket.metrics["501_V1"].bestAverage?.sessionId).toBe("short");
  });

  it("merging a null group onto a real one keeps the real one", () => {
    const [bucket] = sessionResultBuckets(
      [
        row({
          contextKey: "STANDALONE",
          bestAvgSessionId: "pb",
          bestAvgPoints: 300,
          bestAvgDarts: 15,
          bestAvgCompletedAt: "2026-01-20T10:00:00.000Z",
        }),
        row({
          contextKey: "ROUTINE",
          bestAvgSessionId: null,
          bestAvgPoints: null,
          bestAvgDarts: null,
          bestAvgCompletedAt: null,
        }),
      ],
      ctx,
    );
    expect(bucket.metrics["501_V1"].bestAverage?.sessionId).toBe("pb");
  });
});
