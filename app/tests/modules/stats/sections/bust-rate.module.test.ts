import { describe, expect, it } from "vitest";
import { bustRateBuckets } from "@modules/stats/sections/bust-rate.module";
import type { BucketedSession, DartFact, StagedVisit } from "@modules/types";

const CTX = {
  to: "2026-02-01T00:00:00.000Z",
  now: new Date("2026-03-01T00:00:00.000Z"),
};

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartFact["hitZoneKey"],
  score: number,
): DartFact {
  return {
    sequence: 1,
    intendedTargetNumber: null,
    intendedZoneKey: null,
    hitTargetNumber,
    hitZoneKey,
    score,
    locationX: null,
    locationY: null,
  };
}

function visit(startingRemaining: number, darts: DartFact[]): StagedVisit {
  return {
    startingRemaining,
    countedTotal: darts.reduce((sum, d) => sum + d.score, 0),
    darts,
    stageId: "stage-1",
    stageTypeKey: "LEG",
  };
}

function session(
  overrides: Partial<BucketedSession> & { visits: StagedVisit[] },
): BucketedSession {
  return {
    sessionId: "session-1",
    gameTypeKey: "501",
    rulesetVersionKey: "501_V1",
    bucketStart: "2026-01-01T00:00:00.000Z",
    bucketEnd: "2026-02-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("bustRateBuckets", () => {
  it("counts a bust that leaves exactly 1 (40: S20, S19)", () => {
    const s = session({
      visits: [visit(40, [dart(20, "SINGLE", 20), dart(19, "SINGLE", 19)])],
    });

    const [bucket] = bustRateBuckets([s], CTX);

    expect(bucket.metrics).toEqual({ "40": { visits: 1, busts: 1 } });
    expect(bucket.sampleSize).toBe(1);
  });

  it("counts a bust that reaches zero off a single (40: S20, S20)", () => {
    const s = session({
      visits: [visit(40, [dart(20, "SINGLE", 20), dart(20, "SINGLE", 20)])],
    });

    const [bucket] = bustRateBuckets([s], CTX);

    expect(bucket.metrics).toEqual({ "40": { visits: 1, busts: 1 } });
  });

  it("counts no bust for a clean double-out (40: D20)", () => {
    const s = session({ visits: [visit(40, [dart(20, "DOUBLE", 40)])] });

    const [bucket] = bustRateBuckets([s], CTX);

    expect(bucket.metrics).toEqual({ "40": { visits: 1, busts: 0 } });
  });

  it("does not count a visit above 180", () => {
    const s = session({ visits: [visit(301, [dart(20, "TREBLE", 60)])] });

    expect(bustRateBuckets([s], CTX)).toEqual([]);
  });

  it("does not count a TUOD failed attempt with three misses as a bust", () => {
    const s = session({
      gameTypeKey: "TUOD",
      visits: [
        visit(41, [
          dart(null, "MISS", 0),
          dart(null, "MISS", 0),
          dart(null, "MISS", 0),
        ]),
      ],
    });

    const [bucket] = bustRateBuckets([s], CTX);

    expect(bucket.metrics).toEqual({ "41": { visits: 1, busts: 0 } });
  });

  it("sums two sessions in the same bucket and splits sessions across two buckets", () => {
    const a = session({
      sessionId: "a",
      visits: [visit(40, [dart(20, "DOUBLE", 40)])],
    });
    const b = session({
      sessionId: "b",
      visits: [visit(40, [dart(20, "SINGLE", 20), dart(20, "SINGLE", 20)])],
    });
    const c = session({
      sessionId: "c",
      bucketStart: "2026-02-01T00:00:00.000Z",
      bucketEnd: "2026-03-01T00:00:00.000Z",
      visits: [visit(40, [dart(20, "DOUBLE", 40)])],
    });

    const buckets = bustRateBuckets([a, b, c], {
      to: "2026-03-01T00:00:00.000Z",
      now: new Date("2026-04-01T00:00:00.000Z"),
    });

    expect(buckets).toHaveLength(2);
    expect(buckets[0]!.metrics).toEqual({ "40": { visits: 2, busts: 1 } });
    expect(buckets[1]!.metrics).toEqual({ "40": { visits: 1, busts: 0 } });
  });
});
