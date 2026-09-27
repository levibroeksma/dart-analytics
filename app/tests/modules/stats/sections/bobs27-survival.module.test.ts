import { describe, expect, it } from "vitest";
import { sessionSteps } from "@modules/stats/derived-aims.module";
import { bobs27SurvivalBuckets } from "@modules/stats/sections/bobs27-survival.module";
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

function bobs27Config(overrides: Record<string, unknown> = {}) {
  return {
    start_score: 27,
    bull_hit_value: 50,
    miss_penalty_multiplier: 1,
    seats: SEATS,
    ...overrides,
  };
}

let rowSeq = 0;

/** One `DartFoldRow` for a Bob's 27 session, a fresh `turnSequence` per call. */
function row(overrides: Partial<DartFoldRow>): DartFoldRow {
  rowSeq += 1;
  return {
    sessionId: "session-1",
    gameTypeKey: "BOBS27",
    rulesetVersionKey: "BOBS27_V1",
    configuration: bobs27Config(),
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

describe("bobs27SurvivalBuckets", () => {
  it("a run lost on D4 dies there, having reached D1 through D4", () => {
    const darts = [
      hit(1, "DOUBLE"),
      miss(),
      miss(), // D1: one hit, advances
      hit(2, "DOUBLE"),
      miss(),
      miss(), // D2: one hit, advances
      hit(3, "DOUBLE"),
      miss(),
      miss(), // D3: one hit, advances
      miss(),
      miss(),
      miss(), // D4: all miss, penalty resolves at or below zero
    ];
    const rows = rowsFor(
      {
        sessionId: "session-lost-d4",
        configuration: bobs27Config({
          start_score: 1,
          miss_penalty_multiplier: 5,
        }),
      },
      darts,
    );

    const { sessions, skippedSessions } = sessionSteps(rows);
    expect(skippedSessions).toBe(0);

    const [bucket] = bobs27SurvivalBuckets(sessions, CTX);
    const [group] = Object.values(bucket!.metrics);

    expect(group!.died).toEqual({ "DOUBLE:4": 1 });
    expect(group!.reached).toEqual({
      "DOUBLE:1": 1,
      "DOUBLE:2": 1,
      "DOUBLE:3": 1,
      "DOUBLE:4": 1,
    });
    expect(group!.completed).toBe(0);
    expect(group!.runs).toBe(1);
  });

  it("a won run reaches INNER_BULL:25", () => {
    const numberVisits = Array.from({ length: 20 }, (_, i) => [
      hit(i + 1, "DOUBLE"),
      miss(),
      miss(),
    ]).flat();
    const darts = [...numberVisits, hit(25, "INNER_BULL"), miss(), miss()];
    const rows = rowsFor({ sessionId: "session-won" }, darts);

    const { sessions, skippedSessions } = sessionSteps(rows);
    expect(skippedSessions).toBe(0);

    const [bucket] = bobs27SurvivalBuckets(sessions, CTX);
    const [group] = Object.values(bucket!.metrics);

    expect(group!.reached["INNER_BULL:25"]).toBe(1);
    expect(group!.completed).toBe(1);
  });

  it("computes scoreAfter's min and max across two runs reaching the same target", () => {
    const lowRows = rowsFor(
      {
        sessionId: "session-low",
        configuration: bobs27Config({ start_score: 0 }),
      },
      [hit(1, "DOUBLE"), miss(), miss()],
    );
    const highRows = rowsFor(
      {
        sessionId: "session-high",
        configuration: bobs27Config({ start_score: 0 }),
      },
      [hit(1, "DOUBLE"), hit(1, "DOUBLE"), hit(1, "DOUBLE")],
    );

    const { sessions, skippedSessions } = sessionSteps([
      ...lowRows,
      ...highRows,
    ]);
    expect(skippedSessions).toBe(0);

    const [bucket] = bobs27SurvivalBuckets(sessions, CTX);
    const [group] = Object.values(bucket!.metrics);

    expect(group!.scoreAfter["DOUBLE:1"]).toEqual({
      runs: 2,
      sum: 8,
      min: 2,
      max: 6,
    });
  });

  it("different start_score configuration lands sessions in different groups", () => {
    const rows = [
      ...rowsFor(
        {
          sessionId: "session-27",
          configuration: bobs27Config({ start_score: 27 }),
        },
        [hit(1, "DOUBLE")],
      ),
      ...rowsFor(
        {
          sessionId: "session-50",
          configuration: bobs27Config({ start_score: 50 }),
        },
        [hit(1, "DOUBLE")],
      ),
    ];

    const { sessions, skippedSessions } = sessionSteps(rows);
    expect(skippedSessions).toBe(0);

    const [bucket] = bobs27SurvivalBuckets(sessions, CTX);

    expect(Object.keys(bucket!.metrics)).toHaveLength(2);
  });
});
