import { describe, expect, it } from "vitest";
import {
  doublePerformanceBuckets,
  doubleTargetKey,
} from "@modules/stats/sections/double-performance.module";
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

describe("doubleTargetKey", () => {
  it("keys the inner bull at 50", () => {
    expect(doubleTargetKey(50)).toBe("INNER_BULL:25");
  });

  it("keys an even remaining at or under 40 by its half", () => {
    expect(doubleTargetKey(32)).toBe("DOUBLE:16");
    expect(doubleTargetKey(2)).toBe("DOUBLE:1");
    expect(doubleTargetKey(40)).toBe("DOUBLE:20");
  });

  it("returns null for anything else", () => {
    expect(doubleTargetKey(41)).toBeNull();
    expect(doubleTargetKey(45)).toBeNull();
    expect(doubleTargetKey(0)).toBeNull();
  });
});

describe("doublePerformanceBuckets", () => {
  it("counts a checkout on the required double as a hit", () => {
    const s = session({ visits: [visit(32, [dart(16, "DOUBLE", 32)])] });

    const [bucket] = doublePerformanceBuckets([s], CTX);

    expect(bucket.metrics).toEqual({ "DOUBLE:16": { attempts: 1, hits: 1 } });
    expect(bucket.sampleSize).toBe(1);
  });

  it("splits misses across the two doubles a visit passes through", () => {
    const s = session({
      visits: [visit(32, [dart(16, "SINGLE", 16), dart(null, "MISS", 0)])],
    });

    const [bucket] = doublePerformanceBuckets([s], CTX);

    expect(bucket.metrics).toEqual({
      "DOUBLE:16": { attempts: 1, hits: 0 },
      "DOUBLE:8": { attempts: 1, hits: 0 },
    });
  });

  it("does not count a lay-up visit at an odd remaining", () => {
    const s = session({ visits: [visit(45, [dart(5, "SINGLE", 5)])] });

    expect(doublePerformanceBuckets([s], CTX)).toEqual([]);
  });

  it("sums two visits within the same session", () => {
    const s = session({
      visits: [
        visit(32, [dart(16, "DOUBLE", 32)]),
        visit(40, [dart(20, "DOUBLE", 40)]),
      ],
    });

    const [bucket] = doublePerformanceBuckets([s], CTX);

    expect(bucket.metrics).toEqual({
      "DOUBLE:16": { attempts: 1, hits: 1 },
      "DOUBLE:20": { attempts: 1, hits: 1 },
    });
    expect(bucket.sampleSize).toBe(2);
  });

  it("sums two sessions in the same bucket and splits sessions across two buckets", () => {
    const a = session({
      sessionId: "a",
      visits: [visit(32, [dart(16, "DOUBLE", 32)])],
    });
    const b = session({
      sessionId: "b",
      visits: [visit(32, [dart(5, "DOUBLE", 10)])],
    });
    const c = session({
      sessionId: "c",
      bucketStart: "2026-02-01T00:00:00.000Z",
      bucketEnd: "2026-03-01T00:00:00.000Z",
      visits: [visit(32, [dart(16, "DOUBLE", 32)])],
    });

    const buckets = doublePerformanceBuckets([a, b, c], {
      to: "2026-03-01T00:00:00.000Z",
      now: new Date("2026-04-01T00:00:00.000Z"),
    });

    expect(buckets).toHaveLength(2);
    expect(buckets[0]!.metrics).toEqual({
      "DOUBLE:16": { attempts: 2, hits: 1 },
    });
    expect(buckets[1]!.metrics).toEqual({
      "DOUBLE:16": { attempts: 1, hits: 1 },
    });
  });
});
