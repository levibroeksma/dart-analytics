import { describe, expect, it } from "vitest";
import { checkoutRateBuckets } from "@modules/stats/sections/checkout-rate.module";
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

describe("checkoutRateBuckets", () => {
  it("counts a chance and its finish for a 170 checkout", () => {
    const s = session({
      visits: [
        visit(170, [
          dart(20, "TREBLE", 60),
          dart(20, "TREBLE", 60),
          dart(25, "INNER_BULL", 50),
        ]),
      ],
    });

    const [bucket] = checkoutRateBuckets([s], CTX);

    expect(bucket.metrics).toEqual({ "170": { chances: 1, finished: 1 } });
    expect(bucket.sampleSize).toBe(1);
  });

  it("counts nothing for a bogey remaining", () => {
    const s = session({ visits: [visit(169, [dart(null, "MISS", 0)])] });

    expect(checkoutRateBuckets([s], CTX)).toEqual([]);
  });

  it("counts a chance with no finish for 32 left, S16/S8/MISS", () => {
    const s = session({
      visits: [
        visit(32, [
          dart(16, "SINGLE", 16),
          dart(8, "SINGLE", 8),
          dart(null, "MISS", 0),
        ]),
      ],
    });

    const [bucket] = checkoutRateBuckets([s], CTX);

    expect(bucket.metrics).toEqual({ "32": { chances: 1, finished: 0 } });
  });

  it("sums two sessions in the same bucket and splits sessions across two buckets", () => {
    const a = session({
      sessionId: "a",
      visits: [visit(40, [dart(20, "DOUBLE", 40)])],
    });
    const b = session({
      sessionId: "b",
      visits: [visit(40, [dart(1, "DOUBLE", 2)])],
    });
    const c = session({
      sessionId: "c",
      bucketStart: "2026-02-01T00:00:00.000Z",
      bucketEnd: "2026-03-01T00:00:00.000Z",
      visits: [visit(40, [dart(20, "DOUBLE", 40)])],
    });

    const buckets = checkoutRateBuckets([a, b, c], {
      to: "2026-03-01T00:00:00.000Z",
      now: new Date("2026-04-01T00:00:00.000Z"),
    });

    expect(buckets).toHaveLength(2);
    expect(buckets[0]!.metrics).toEqual({ "40": { chances: 2, finished: 1 } });
    expect(buckets[1]!.metrics).toEqual({ "40": { chances: 1, finished: 1 } });
  });
});
