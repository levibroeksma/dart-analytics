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
