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
