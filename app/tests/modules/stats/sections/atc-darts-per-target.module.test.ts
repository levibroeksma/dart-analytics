import { describe, expect, it } from "vitest";
import { sessionSteps } from "@modules/stats/derived-aims.module";
import { atcDartsPerTargetBuckets } from "@modules/stats/sections/atc-darts-per-target.module";
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

function atcV2Config(overrides: Record<string, unknown> = {}) {
  return {
    path_direction: "LOW_TO_HIGH",
    odds_first: false,
    segment_rule: "ANY",
    difficulty: "EASY",
    duration_type: "UNTIMED",
    duration_value: null,
    seats: SEATS,
    ...overrides,
  };
}

let rowSeq = 0;

/** One `DartFoldRow` for an Around the Clock session, a fresh `turnSequence` per call. */
function row(overrides: Partial<DartFoldRow>): DartFoldRow {
  rowSeq += 1;
  return {
    sessionId: "session-1",
    gameTypeKey: "AROUND_THE_CLOCK",
    rulesetVersionKey: "AROUND_THE_CLOCK_V1",
    configuration: {},
    sessionDartCount: 1,
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

describe("atcDartsPerTargetBuckets", () => {
  it("V1: a miss then a hit gives NUMBER:1 { darts: 2, cleared: 1 }", () => {
    const rows = rowsFor(
      {
        sessionId: "session-atc-v1",
        gameTypeKey: "AROUND_THE_CLOCK",
        rulesetVersionKey: "AROUND_THE_CLOCK_V1",
        configuration: {},
      },
      [miss(), hit(1, "OUTER_SINGLE")],
    );

    const { sessions, skippedSessions } = sessionSteps(rows);
    expect(skippedSessions).toBe(0);

    const [bucket] = atcDartsPerTargetBuckets(sessions, CTX);
    const [group] = Object.values(bucket!.metrics);

    expect(group).toEqual({ "NUMBER:1": { darts: 2, cleared: 1 } });
  });

  it("V2 Hard: a visit that fails and steps back leaves its target uncleared", () => {
    const darts = [
      hit(1, "OUTER_SINGLE"),
      hit(1, "OUTER_SINGLE"),
      hit(1, "OUTER_SINGLE"), // round 1 (number 1): 3 hits, advances
      hit(2, "OUTER_SINGLE"),
      hit(2, "OUTER_SINGLE"),
      hit(2, "OUTER_SINGLE"), // round 2 (number 2): 3 hits, advances
      miss(),
      miss(),
      miss(), // round 3 (number 3): 0 hits (< hitsRequired 2), steps back
    ];
    const rows = rowsFor(
      {
        sessionId: "session-atc-v2-hard",
        gameTypeKey: "AROUND_THE_CLOCK",
        rulesetVersionKey: "AROUND_THE_CLOCK_V2",
        configuration: atcV2Config({ difficulty: "HARD" }),
      },
      darts,
    );

    const { sessions, skippedSessions } = sessionSteps(rows);
    expect(skippedSessions).toBe(0);

    const [bucket] = atcDartsPerTargetBuckets(sessions, CTX);
    const [group] = Object.values(bucket!.metrics);

    expect(group!["NUMBER:3"]).toEqual({ darts: 3, cleared: 0 });
  });

  it("Timed: a lap on BULL counts as a clear", () => {
    const clears = Array.from({ length: 20 }, (_, i) =>
      hit(i + 1, "OUTER_SINGLE"),
    );
    const darts = [...clears, hit(25, "OUTER_BULL")];
    const rows = rowsFor(
      {
        sessionId: "session-atc-timed",
        gameTypeKey: "AROUND_THE_CLOCK",
        rulesetVersionKey: "AROUND_THE_CLOCK_V2",
        configuration: atcV2Config({
          duration_type: "MINUTES",
          duration_value: 5,
        }),
      },
      darts,
    );

    const { sessions, skippedSessions } = sessionSteps(rows);
    expect(skippedSessions).toBe(0);

    const [bucket] = atcDartsPerTargetBuckets(sessions, CTX);
    const [group] = Object.values(bucket!.metrics);

    expect(group!["BULL:25"]).toEqual({ darts: 1, cleared: 1 });
  });

  it("V1 and V2 sessions land in different config groups", () => {
    const v1Rows = rowsFor(
      {
        sessionId: "session-v1",
        rulesetVersionKey: "AROUND_THE_CLOCK_V1",
        configuration: {},
      },
      [hit(1, "OUTER_SINGLE")],
    );
    const v2Rows = rowsFor(
      {
        sessionId: "session-v2",
        rulesetVersionKey: "AROUND_THE_CLOCK_V2",
        configuration: atcV2Config(),
      },
      [hit(1, "OUTER_SINGLE")],
    );

    const { sessions, skippedSessions } = sessionSteps([...v1Rows, ...v2Rows]);
    expect(skippedSessions).toBe(0);

    const [bucket] = atcDartsPerTargetBuckets(sessions, CTX);

    expect(Object.keys(bucket!.metrics)).toHaveLength(2);
  });
});
