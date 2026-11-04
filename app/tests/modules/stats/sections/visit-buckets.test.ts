import { describe, expect, it } from "vitest";
import { visitBuckets } from "@modules/stats/sections/series.module";
import type { BucketedSession, StagedVisit } from "@modules/types";

const CTX = {
  to: "2026-03-01T00:00:00.000Z",
  now: new Date("2026-04-01T00:00:00.000Z"),
};

function visit(startingRemaining: number): StagedVisit {
  return {
    startingRemaining,
    countedTotal: 0,
    darts: [],
    stageId: "stage-1",
    stageTypeKey: "LEG",
  };
}

function session(
  bucketStart: string,
  bucketEnd: string,
  remainings: number[],
): BucketedSession {
  return {
    sessionId: `session-${bucketStart}`,
    gameTypeKey: "501",
    rulesetVersionKey: "501_V1",
    undecodable: false,
    bucketStart,
    bucketEnd,
    visits: remainings.map(visit),
  };
}

const SPEC = {
  include: (v: StagedVisit) => v.startingRemaining <= 180,
  keyOf: (v: StagedVisit) => String(v.startingRemaining),
  empty: () => ({ n: 0 }),
  add: (entry: { n: number }) => {
    entry.n += 1;
  },
};

describe("visitBuckets", () => {
  it("returns [] for no sessions", () => {
    expect(visitBuckets([], CTX, SPEC)).toEqual([]);
  });

  it("skips filtered visits, sums per key, drops a bucket with no included visit, sorts and stamps closed", () => {
    const later = session(
      "2026-02-01T00:00:00.000Z",
      "2026-03-01T00:00:00.000Z",
      [40, 301],
    );
    const empty = session(
      "2026-03-01T00:00:00.000Z",
      "2026-04-01T00:00:00.000Z",
      [301],
    );
    const earlier = session(
      "2026-01-01T00:00:00.000Z",
      "2026-02-01T00:00:00.000Z",
      [40, 200, 40, 32],
    );

    expect(visitBuckets([later, empty, earlier], CTX, SPEC)).toEqual([
      {
        start: "2026-01-01T00:00:00.000Z",
        end: "2026-02-01T00:00:00.000Z",
        closed: true,
        sampleSize: 3,
        metrics: { "40": { n: 2 }, "32": { n: 1 } },
      },
      {
        start: "2026-02-01T00:00:00.000Z",
        end: "2026-03-01T00:00:00.000Z",
        closed: true,
        sampleSize: 1,
        metrics: { "40": { n: 1 } },
      },
    ]);
  });

  it("keeps the first session's bucketEnd for a start even when that session had no included visit", () => {
    const first = session(
      "2026-02-01T00:00:00.000Z",
      "2026-03-01T00:00:00.000Z",
      [301],
    );
    const second = session(
      "2026-02-01T00:00:00.000Z",
      "2026-09-01T00:00:00.000Z",
      [40],
    );

    const [bucket] = visitBuckets([first, second], CTX, SPEC);

    expect(bucket!.end).toBe("2026-03-01T00:00:00.000Z");
    expect(bucket!.closed).toBe(true);
    expect(bucket!.sampleSize).toBe(1);
  });
});
