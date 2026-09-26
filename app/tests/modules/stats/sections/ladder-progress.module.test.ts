import { describe, expect, it } from "vitest";
import {
  ladderAttempts,
  ladderProgressBuckets,
} from "@modules/stats/sections/ladder-progress.module";
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

function visit(
  startingRemaining: number,
  darts: DartFact[],
  overrides: Partial<Pick<StagedVisit, "stageId" | "stageTypeKey">> = {},
): StagedVisit {
  return {
    startingRemaining,
    countedTotal: darts.reduce((sum, d) => sum + d.score, 0),
    darts,
    stageId: overrides.stageId ?? "stage-1",
    stageTypeKey: overrides.stageTypeKey ?? "EXERCISE_BLOCK",
  };
}

function session(
  overrides: Partial<SessionCheckoutVisits> & { visits: StagedVisit[] },
): SessionCheckoutVisits {
  return {
    sessionId: "session-1",
    gameTypeKey: "TUOD",
    rulesetVersionKey: "TUOD_V1",
    ...overrides,
  };
}

function bucketedSession(
  overrides: Partial<BucketedSession> & { visits: StagedVisit[] },
): BucketedSession {
  return {
    sessionId: "session-1",
    gameTypeKey: "TUOD",
    rulesetVersionKey: "TUOD_V1",
    bucketStart: "2026-01-01T00:00:00.000Z",
    bucketEnd: "2026-02-01T00:00:00.000Z",
    ...overrides,
  };
}

const MISS = dart(null, "MISS", 0);

/**
 * A dart sequence that finishes exactly at `remaining`: one dart for an
 * even remaining at most 40 or for the bull, two otherwise (a lead-in dart
 * that leaves 32, then `D16`).
 */
function finishingDarts(remaining: number): DartFact[] {
  if (remaining === 50) return [dart(25, "INNER_BULL", 50)];
  if (remaining % 2 === 0 && remaining <= 40) {
    return [dart(remaining / 2, "DOUBLE", remaining)];
  }
  return [dart(null, "SINGLE", remaining - 32), dart(16, "DOUBLE", 32)];
}

describe("ladderAttempts", () => {
  it("gives one attempt per visit for TUOD", () => {
    const s = session({
      gameTypeKey: "TUOD",
      visits: [
        visit(41, finishingDarts(41)),
        visit(51, [MISS, MISS, MISS]),
        visit(50, finishingDarts(50)),
      ],
    });

    expect(ladderAttempts(s)).toEqual([
      { target: 41, success: true },
      { target: 51, success: false },
      { target: 50, success: true },
    ]);
  });

  it("groups a 121 round's visits into one attempt targeted at the round's first remaining", () => {
    const s = session({
      gameTypeKey: "ONE_TWENTY_ONE",
      visits: [
        visit(121, [MISS], { stageId: "round-1", stageTypeKey: "ROUND" }),
        visit(81, [MISS], { stageId: "round-1", stageTypeKey: "ROUND" }),
        visit(41, finishingDarts(41), {
          stageId: "round-1",
          stageTypeKey: "ROUND",
        }),
      ],
    });

    expect(ladderAttempts(s)).toEqual([{ target: 121, success: true }]);
  });

  it("keeps two 121 rounds as two attempts", () => {
    const s = session({
      gameTypeKey: "ONE_TWENTY_ONE",
      visits: [
        visit(121, [MISS], { stageId: "round-1", stageTypeKey: "ROUND" }),
        visit(101, [MISS], { stageId: "round-2", stageTypeKey: "ROUND" }),
      ],
    });

    expect(ladderAttempts(s)).toEqual([
      { target: 121, success: false },
      { target: 101, success: false },
    ]);
  });
});

describe("ladderProgressBuckets", () => {
  it("gives maxTarget, afterMiss and recovered for a TUOD 41/51/50 sequence", () => {
    const s = bucketedSession({
      gameTypeKey: "TUOD",
      visits: [
        visit(41, finishingDarts(41)),
        visit(51, [MISS, MISS, MISS]),
        visit(50, finishingDarts(50)),
      ],
    });

    const [bucket] = ladderProgressBuckets([s], CTX);

    expect(bucket.metrics.maxTarget).toBe(51);
    expect(bucket.metrics.afterMiss).toBe(1);
    expect(bucket.metrics.recovered).toBe(1);
    expect(bucket.metrics.targets).toEqual({
      "41": { attempts: 1, successes: 1 },
      "51": { attempts: 1, successes: 0 },
      "50": { attempts: 1, successes: 1 },
    });
    expect(bucket.sampleSize).toBe(3);
  });

  it("does not carry afterMiss across sessions", () => {
    const a = bucketedSession({
      sessionId: "a",
      gameTypeKey: "TUOD",
      visits: [visit(51, [MISS, MISS, MISS])],
    });
    const b = bucketedSession({
      sessionId: "b",
      gameTypeKey: "TUOD",
      visits: [visit(41, finishingDarts(41))],
    });

    const [bucket] = ladderProgressBuckets([a, b], CTX);

    expect(bucket.metrics.afterMiss).toBe(0);
    expect(bucket.metrics.recovered).toBe(0);
    expect(bucket.metrics.maxTarget).toBe(51);
  });

  it("gives no buckets and a null maxTarget for no attempts", () => {
    const s = bucketedSession({ gameTypeKey: "TUOD", visits: [] });

    expect(ladderProgressBuckets([s], CTX)).toEqual([]);
  });
});
