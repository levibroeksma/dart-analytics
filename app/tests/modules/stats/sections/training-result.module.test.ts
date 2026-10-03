import { describe, expect, it } from "vitest";
import { sessionSteps } from "@modules/stats/derived-aims.module";
import { trainingResultBuckets } from "@modules/stats/sections/training-result.module";
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

const LOW_TO_HIGH = [...Array.from({ length: 20 }, (_, i) => i + 1), 25];

const SINGLES_CONFIG = {
  seats: SEATS,
  order_mode: "LOW_TO_HIGH",
  target_order: LOW_TO_HIGH,
  difficulty: "EASY",
  scoring_mode: "STANDARD",
};

const DOUBLES_CONFIG = {
  seats: SEATS,
  mode: "EASY",
  order_mode: "LOW_TO_HIGH",
  target_order: LOW_TO_HIGH,
};

let rowSeq = 0;

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

function rowsFor(
  meta: Partial<DartFoldRow>,
  darts: readonly DartObservation[],
): DartFoldRow[] {
  return darts.map((observation) => {
    rowSeq += 1;
    return {
      sessionId: "session-1",
      gameTypeKey: "SINGLES_TRAINING",
      rulesetVersionKey: "SINGLES_V3",
      configuration: SINGLES_CONFIG,
      bucketStart: "2026-09-01T00:00:00.000Z",
      bucketEnd: "2026-10-01T00:00:00.000Z",
      turnSequence: rowSeq,
      dartNumber: 1,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      ...meta,
      sessionDartCount: darts.length,
      hitTargetNumber: observation.hitTargetNumber,
      hitZoneKey: observation.hitZoneKey,
      locationX: observation.locationX,
      locationY: observation.locationY,
    };
  });
}

describe("trainingResultBuckets", () => {
  it("sums a Singles session's training points (S1 + D1 + T1 = 6)", () => {
    const rows = rowsFor({}, [
      hit(1, "OUTER_SINGLE"),
      hit(1, "DOUBLE"),
      hit(1, "TREBLE"), // target 1: 1 + 2 + 3
      miss(),
      miss(),
      miss(), // target 2: nothing
    ]);

    const { sessions, skippedSessions } = sessionSteps(rows);
    expect(skippedSessions).toBe(0);

    const [bucket] = trainingResultBuckets(sessions, CTX);

    expect(bucket!.sampleSize).toBe(1);
    expect(bucket!.metrics).toEqual({
      "SINGLES_V3|difficulty=EASY|scoring_mode=STANDARD": {
        sessions: 1,
        total: 6,
        best: 6,
      },
    });
  });

  it("counts a Doubles session's hit visits, not its darts", () => {
    const rows = rowsFor(
      {
        gameTypeKey: "DOUBLES_TRAINING",
        rulesetVersionKey: "DOUBLES_TRAINING_V1",
        configuration: DOUBLES_CONFIG,
      },
      [
        hit(1, "DOUBLE"), // D1 hit on the first dart: visit ends
        miss(),
        miss(),
        miss(), // D2 missed
        miss(),
        hit(3, "DOUBLE"), // D3 hit on the second dart
      ],
    );

    const { sessions, skippedSessions } = sessionSteps(rows);
    expect(skippedSessions).toBe(0);

    const [bucket] = trainingResultBuckets(sessions, CTX);

    expect(bucket!.metrics).toEqual({
      "DOUBLES_TRAINING_V1|difficulty=|scoring_mode=": {
        sessions: 1,
        total: 2,
        best: 2,
      },
    });
  });

  it("keeps the best and the total per config group across sessions", () => {
    const low = rowsFor({ sessionId: "low" }, [hit(1, "OUTER_SINGLE")]);
    const high = rowsFor({ sessionId: "high" }, [hit(1, "TREBLE")]);
    const hard = rowsFor(
      {
        sessionId: "hard",
        configuration: { ...SINGLES_CONFIG, difficulty: "HARD" },
      },
      [hit(1, "TREBLE")],
    );

    const { sessions } = sessionSteps([...low, ...high, ...hard]);
    const [bucket] = trainingResultBuckets(sessions, CTX);

    expect(bucket!.sampleSize).toBe(3);
    expect(bucket!.metrics).toEqual({
      "SINGLES_V3|difficulty=EASY|scoring_mode=STANDARD": {
        sessions: 2,
        total: 4,
        best: 3,
      },
      "SINGLES_V3|difficulty=HARD|scoring_mode=STANDARD": {
        sessions: 1,
        total: 3,
        best: 3,
      },
    });
  });
});
