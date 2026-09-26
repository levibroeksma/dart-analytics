import { describe, expect, it } from "vitest";
import {
  legDarts,
  legStatsBuckets,
} from "@modules/stats/sections/leg-stats.module";
import type {
  BucketedSession,
  DartFact,
  SessionCheckoutVisits,
  StagedVisit,
} from "@modules/types";

const CTX = {
  to: "2026-02-01T00:00:00.000Z",
  now: new Date("2026-03-01T00:00:00.000Z"),
};

function darts(count: number, finishing = false): DartFact[] {
  const miss: DartFact = {
    sequence: 1,
    intendedTargetNumber: null,
    intendedZoneKey: null,
    hitTargetNumber: null,
    hitZoneKey: "MISS",
    score: 0,
    locationX: null,
    locationY: null,
  };
  const finish: DartFact = {
    sequence: 1,
    intendedTargetNumber: 20,
    intendedZoneKey: null,
    hitTargetNumber: 20,
    hitZoneKey: "DOUBLE",
    score: 40,
    locationX: null,
    locationY: null,
  };
  const out = Array.from({ length: count }, () => miss);
  if (finishing) out[out.length - 1] = finish;
  return out;
}

function visit(
  stageId: string,
  dartCount: number,
  finishing = false,
): StagedVisit {
  const visitDarts = darts(dartCount, finishing);
  return {
    startingRemaining: 40,
    countedTotal: visitDarts.reduce((sum, d) => sum + d.score, 0),
    darts: visitDarts,
    stageId,
    stageTypeKey: "LEG",
  };
}

function session(
  overrides: Partial<SessionCheckoutVisits> & { visits: StagedVisit[] },
): SessionCheckoutVisits {
  return {
    sessionId: "session-1",
    gameTypeKey: "501",
    rulesetVersionKey: "501_V1",
    ...overrides,
  };
}

function bucketedSession(
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

describe("legDarts", () => {
  it("counts a finished leg's darts and excludes an unfinished last leg", () => {
    const s = session({
      visits: [
        visit("leg-1", 9, false),
        visit("leg-1", 9, true),
        visit("leg-2", 9, false),
      ],
    });

    expect(legDarts(s)).toEqual([18]);
  });

  it("excludes a 1v1 leg the opponent won (no owner finishing dart)", () => {
    const s = session({
      visits: [visit("leg-1", 9, false), visit("leg-1", 6, false)],
    });

    expect(legDarts(s)).toEqual([]);
  });

  it("ignores non-LEG stages", () => {
    const s = session({
      visits: [
        {
          ...visit("round-1", 3, true),
          stageTypeKey: "ROUND",
        },
      ],
    });

    expect(legDarts(s)).toEqual([]);
  });
});

describe("legStatsBuckets", () => {
  it("fills a darts-per-leg histogram", () => {
    const s = bucketedSession({
      visits: [
        visit("leg-1", 9, false),
        visit("leg-1", 9, true),
        visit("leg-2", 15, true),
      ],
    });

    const [bucket] = legStatsBuckets([s], CTX);

    expect(bucket.metrics).toEqual({ "18": 1, "15": 1 });
    expect(bucket.sampleSize).toBe(2);
  });

  it("sums two legs of the same length across sessions in the same bucket", () => {
    const a = bucketedSession({
      sessionId: "a",
      visits: [visit("leg-1", 9, false), visit("leg-1", 9, true)],
    });
    const b = bucketedSession({
      sessionId: "b",
      visits: [visit("leg-1", 18, true)],
    });

    const [bucket] = legStatsBuckets([a, b], CTX);

    expect(bucket.metrics).toEqual({ "18": 2 });
  });

  it("gives no buckets for no finished legs", () => {
    const s = bucketedSession({ visits: [visit("leg-1", 9, false)] });

    expect(legStatsBuckets([s], CTX)).toEqual([]);
  });
});
