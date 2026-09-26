import { describe, expect, it } from "vitest";
import { checkoutPathBuckets } from "@modules/stats/sections/checkout-path.module";
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

describe("checkoutPathBuckets", () => {
  it("labels the 170 finish route", () => {
    const s = session({
      visits: [
        visit(170, [
          dart(20, "TREBLE", 60),
          dart(20, "TREBLE", 60),
          dart(25, "INNER_BULL", 50),
        ]),
      ],
    });

    const [bucket] = checkoutPathBuckets([s], CTX);

    expect(bucket.metrics).toEqual({
      "170": { "T20 T20 BULL": { visits: 1, finished: 1 } },
    });
    expect(bucket.sampleSize).toBe(1);
  });

  it("labels an 81 two-dart finish", () => {
    const s = session({
      visits: [visit(81, [dart(19, "TREBLE", 57), dart(12, "DOUBLE", 24)])],
    });

    const [bucket] = checkoutPathBuckets([s], CTX);

    expect(bucket.metrics).toEqual({
      "81": { "T19 D12": { visits: 1, finished: 1 } },
    });
  });

  it("excludes an unreachable remaining", () => {
    const s = session({ visits: [visit(169, [dart(null, "MISS", 0)])] });

    expect(checkoutPathBuckets([s], CTX)).toEqual([]);
  });

  it("sums two sessions in the same bucket and splits sessions across two buckets", () => {
    const a = session({
      sessionId: "a",
      visits: [visit(40, [dart(20, "DOUBLE", 40)])],
    });
    const b = session({
      sessionId: "b",
      visits: [visit(40, [dart(20, "DOUBLE", 40)])],
    });
    const c = session({
      sessionId: "c",
      bucketStart: "2026-02-01T00:00:00.000Z",
      bucketEnd: "2026-03-01T00:00:00.000Z",
      visits: [visit(40, [dart(1, "SINGLE", 1), dart(20, "SINGLE", 20)])],
    });

    const buckets = checkoutPathBuckets([a, b, c], {
      to: "2026-03-01T00:00:00.000Z",
      now: new Date("2026-04-01T00:00:00.000Z"),
    });

    expect(buckets).toHaveLength(2);
    expect(buckets[0]!.metrics).toEqual({
      "40": { D20: { visits: 2, finished: 2 } },
    });
    expect(buckets[1]!.metrics).toEqual({
      "40": { "1 20": { visits: 1, finished: 0 } },
    });
  });
});
