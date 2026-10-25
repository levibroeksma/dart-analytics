import { describe, expect, it } from "vitest";
import { sessionSteps } from "@modules/stats/derived-aims.module";
import { shanghaiCountBuckets } from "@modules/stats/sections/shanghai-count.module";
import type { DartFoldRow, DartObservation, DartZoneKey } from "@modules/types";

const CTX = {
  to: "2026-10-01T00:00:00.000Z",
  now: new Date("2026-11-01T00:00:00.000Z"),
};

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "HOME",
    participantTypeKey: "PLAYER",
  },
];

let rowSeq = 0;

/** One `DartFoldRow` for a Shanghai session, a fresh `turnSequence` per call. */
function row(overrides: Partial<DartFoldRow>): DartFoldRow {
  rowSeq += 1;
  return {
    sessionId: "session-1",
    gameTypeKey: "SHANGHAI",
    rulesetVersionKey: "SHANGHAI_V1",
    configuration: { seats: SEATS },
    sessionDartCount: 3,
    bucketStart: "2026-09-01T00:00:00.000Z",
    bucketEnd: "2026-10-01T00:00:00.000Z",
    turnSequence: rowSeq,
    dartNumber: 1,
    hitTargetNumber: null,
    hitZoneKey: "MISS",
    intendedTargetNumber: null,
    intendedZoneKey: null,
    locationX: 0,
    locationY: 0,
    ...overrides,
  };
}

function rowsFor(
  meta: Partial<DartFoldRow>,
  darts: readonly DartObservation[],
): DartFoldRow[] {
  return darts.map((observation) =>
    row({
      ...meta,
      sessionDartCount: darts.length,
      hitTargetNumber: observation.hitTargetNumber,
      hitZoneKey: observation.hitZoneKey,
      locationX: observation.locationX,
      locationY: observation.locationY,
    }),
  );
}

function hit(number: number, zone: DartZoneKey): DartObservation {
  return {
    hitTargetNumber: number,
    hitZoneKey: zone,
    locationX: 0,
    locationY: 0,
  };
}

function miss(): DartObservation {
  return {
    hitTargetNumber: null,
    hitZoneKey: "MISS",
    locationX: 0,
    locationY: 0,
  };
}

describe("shanghaiCountBuckets", () => {
  it("counts a Shanghai (S3, D3, T3) and files it under round 3", () => {
    const darts = [
      miss(),
      miss(),
      miss(), // round 1 (number 1) — advances, no Shanghai
      miss(),
      miss(),
      miss(), // round 2 (number 2) — advances, no Shanghai
      hit(3, "OUTER_SINGLE"),
      hit(3, "DOUBLE"),
      hit(3, "TREBLE"), // round 3 — S3, D3, T3
    ];
    const rows = rowsFor({ sessionId: "session-shanghai" }, darts);

    const { sessions, skippedSessions } = sessionSteps(rows);
    expect(skippedSessions).toBe(0);

    const [bucket] = shanghaiCountBuckets(sessions, CTX);

    expect(bucket!.sampleSize).toBe(1);
    expect(bucket!.metrics).toEqual({
      sessions: 1,
      shanghais: 1,
      byRound: { "3": 1 },
    });
  });

  it("counts no Shanghai for a session that reaches COMPLETE instead", () => {
    const darts = Array.from({ length: 20 }, (_, i) => [
      hit(i + 1, "OUTER_SINGLE"),
      hit(i + 1, "OUTER_SINGLE"),
      hit(i + 1, "OUTER_SINGLE"),
    ]).flat();
    const rows = rowsFor({ sessionId: "session-complete" }, darts);

    const { sessions, skippedSessions } = sessionSteps(rows);
    expect(skippedSessions).toBe(0);

    const [bucket] = shanghaiCountBuckets(sessions, CTX);

    expect(bucket!.metrics).toEqual({
      sessions: 1,
      shanghais: 0,
      byRound: {},
    });
  });
});

describe("shanghaiCountBuckets — SHANGHAI_V3", () => {
  const v3Config = (instantWin: boolean) => ({
    seats: SEATS,
    difficulty: "NORMAL",
    range_start: 13,
    range_end: 20,
    instant_win: instantWin,
  });
  const v3Meta = (sessionId: string, instantWin: boolean) => ({
    sessionId,
    rulesetVersionKey: "SHANGHAI_V3",
    configuration: v3Config(instantWin),
  });
  const shanghaiInRoundThree = [
    miss(),
    miss(),
    miss(),
    miss(),
    miss(),
    miss(),
    hit(15, "OUTER_SINGLE"),
    hit(15, "DOUBLE"),
    hit(15, "TREBLE"),
  ];

  it("files a 13-20 Shanghai under the number it landed on, not the round index", () => {
    const rows = rowsFor(v3Meta("session-v3", true), shanghaiInRoundThree);
    const { sessions } = sessionSteps(rows);

    const [bucket] = shanghaiCountBuckets(sessions, CTX);

    expect(bucket!.metrics).toEqual({
      sessions: 1,
      shanghais: 1,
      byRound: { "15": 1 },
    });
  });

  it("leaves a Score-only session out of the denominator", () => {
    const scoreOnly = rowsFor(
      v3Meta("session-score-only", false),
      shanghaiInRoundThree,
    );
    const counted = rowsFor(v3Meta("session-counted", true), [miss()]);
    const { sessions } = sessionSteps([...scoreOnly, ...counted]);

    const [bucket] = shanghaiCountBuckets(sessions, CTX);

    expect(bucket!.metrics.sessions).toBe(1);
    expect(bucket!.sampleSize).toBe(1);
  });

  it("emits no bucket for a Score-only session alone", () => {
    const rows = rowsFor(
      v3Meta("session-score-only", false),
      shanghaiInRoundThree,
    );
    const { sessions } = sessionSteps(rows);

    expect(shanghaiCountBuckets(sessions, CTX)).toEqual([]);
  });
});

describe("shanghaiCountBuckets series order", () => {
  it("returns buckets oldest first, whatever order the sessions arrive in", () => {
    const [early] = sessionSteps(
      rowsFor({ sessionId: "session-shanghai" }, [hit(1, "OUTER_SINGLE")]),
    ).sessions;
    const [late] = sessionSteps(
      rowsFor({ sessionId: "session-late-shanghai" }, [hit(1, "OUTER_SINGLE")]),
    ).sessions;

    const buckets = shanghaiCountBuckets(
      [
        {
          ...late!,
          bucketStart: "2026-02-01T00:00:00.000Z",
          bucketEnd: "2026-03-01T00:00:00.000Z",
        },
        {
          ...early!,
          bucketStart: "2026-01-01T00:00:00.000Z",
          bucketEnd: "2026-02-01T00:00:00.000Z",
        },
      ],
      CTX,
    );

    expect(buckets.map((bucket) => bucket.start)).toEqual([
      "2026-01-01T00:00:00.000Z",
      "2026-02-01T00:00:00.000Z",
    ]);
  });
});
