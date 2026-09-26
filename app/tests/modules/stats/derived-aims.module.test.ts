import { describe, expect, it } from "vitest";
import { SECTOR_ORDER } from "@lib/game/board/board-geometry.module";
import {
  applySinglesTrainingDart,
  initialSinglesTrainingState,
} from "@modules/game/singles-training.engine.module";
import { zoneBucketOf } from "@modules/game/shanghai.engine.module";
import {
  isClockHit,
  rulesOf,
} from "@modules/game/around-the-clock.engine.module";
import { aimedDarts, sessionSteps } from "@modules/stats/derived-aims.module";
import type { DartFoldRow, DartObservation, DartZoneKey } from "@modules/types";

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "HOME",
    participantTypeKey: "PLAYER",
  },
];

/** A 21-length `target_order` (Singles' schema) starting with `first`, containing every other of 1..20 and 25 (BULL) exactly once. */
function targetOrderStartingWith(first: number): number[] {
  const rest = Array.from({ length: 20 }, (_, i) => i + 1).filter(
    (n) => n !== first,
  );
  return [first, ...rest, 25];
}

function singlesConfig(overrides: Record<string, unknown> = {}) {
  return {
    order_mode: "RANDOM",
    target_order: targetOrderStartingWith(7),
    difficulty: "EASY",
    points_single: 1,
    points_double: 2,
    points_treble: 3,
    seats: SEATS,
    ...overrides,
  };
}

function shanghaiV1Config() {
  return { seats: SEATS };
}

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

/**
 * One `DartFoldRow`, defaulting `turnSequence` to a fresh, ever-increasing
 * value each call so a test can build a session's darts as a flat, ordered
 * list without modelling turns/visits at all -- `sessionSteps` sorts by
 * `(turnSequence, dartNumber)` alone, so a distinct `turnSequence` per row
 * with `dartNumber: 1` is exactly as valid an order as real turn boundaries.
 */
function row(overrides: Partial<DartFoldRow>): DartFoldRow {
  rowSeq += 1;
  return {
    sessionId: "session-1",
    gameTypeKey: "SINGLES_TRAINING",
    rulesetVersionKey: "SINGLES_V1",
    configuration: singlesConfig(),
    sessionDartCount: 3,
    bucketStart: "2026-09-01T00:00:00.000Z",
    bucketEnd: "2026-10-01T00:00:00.000Z",
    turnSequence: rowSeq,
    dartNumber: 1,
    hitTargetNumber: 7,
    hitZoneKey: "OUTER_SINGLE",
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

describe("sessionSteps + aimedDarts — Singles Training", () => {
  it("aims the first three darts at the random target_order's first number", () => {
    const rows = rowsFor(
      { gameTypeKey: "SINGLES_TRAINING", rulesetVersionKey: "SINGLES_V1" },
      [hit(7, "OUTER_SINGLE"), miss(), hit(7, "TREBLE")],
    );

    const { sessions, skippedSessions } = sessionSteps(rows);
    expect(skippedSessions).toBe(0);
    expect(sessions).toHaveLength(1);

    const darts = aimedDarts(sessions[0]!);
    expect(darts.map((d) => d.aim)).toEqual([
      "NUMBER:7",
      "NUMBER:7",
      "NUMBER:7",
    ]);
  });
});

describe("sessionSteps + aimedDarts — Shanghai", () => {
  it("aims round 2's darts (4-6) at target index 1's number", () => {
    const rows = rowsFor(
      {
        sessionId: "session-shanghai",
        gameTypeKey: "SHANGHAI",
        rulesetVersionKey: "SHANGHAI_V1",
        configuration: shanghaiV1Config(),
      },
      [
        hit(1, "INNER_SINGLE"),
        miss(),
        miss(),
        hit(2, "INNER_SINGLE"),
        miss(),
        miss(),
      ],
    );

    const { sessions, skippedSessions } = sessionSteps(rows);
    expect(skippedSessions).toBe(0);

    const darts = aimedDarts(sessions[0]!);
    expect(darts.slice(3, 6).map((d) => d.aim)).toEqual([
      "NUMBER:2",
      "NUMBER:2",
      "NUMBER:2",
    ]);
  });
});

describe("sessionSteps + aimedDarts — Around the Clock", () => {
  it("V1: a hit on dart 1 moves dart 2's aim from NUMBER:1 to NUMBER:2 mid-visit", () => {
    const rows = rowsFor(
      {
        sessionId: "session-atc-v1",
        gameTypeKey: "AROUND_THE_CLOCK",
        rulesetVersionKey: "AROUND_THE_CLOCK_V1",
        configuration: {},
      },
      [hit(1, "OUTER_SINGLE"), hit(2, "OUTER_SINGLE")],
    );

    const { sessions, skippedSessions } = sessionSteps(rows);
    expect(skippedSessions).toBe(0);

    const darts = aimedDarts(sessions[0]!);
    expect(darts.map((d) => d.aim)).toEqual(["NUMBER:1", "NUMBER:2"]);
  });

  it("V2 OUTER_SINGLE: aims OUTER_SINGLE:1, and an inner single on 1 is not a hit", () => {
    const rows = rowsFor(
      {
        sessionId: "session-atc-outer",
        gameTypeKey: "AROUND_THE_CLOCK",
        rulesetVersionKey: "AROUND_THE_CLOCK_V2",
        configuration: atcV2Config({ segment_rule: "OUTER_SINGLE" }),
      },
      [hit(1, "INNER_SINGLE")],
    );

    const { sessions } = sessionSteps(rows);
    const darts = aimedDarts(sessions[0]!);

    expect(darts[0]!.aim).toBe("OUTER_SINGLE:1");
    expect(darts[0]!.hit).toBe(false);
  });

  it("aims at BULL:25 once every number on the path has cleared", () => {
    const clears = Array.from({ length: 20 }, (_, i) =>
      hit(i + 1, "OUTER_SINGLE"),
    );
    const rows = rowsFor(
      {
        sessionId: "session-atc-end",
        gameTypeKey: "AROUND_THE_CLOCK",
        rulesetVersionKey: "AROUND_THE_CLOCK_V1",
        configuration: {},
      },
      [...clears, hit(25, "OUTER_BULL")],
    );

    const { sessions, skippedSessions } = sessionSteps(rows);
    expect(skippedSessions).toBe(0);

    const darts = aimedDarts(sessions[0]!);
    expect(darts[20]!.aim).toBe("BULL:25");
  });
});

/** Every ring/neighbour/bull/miss observation `isAimHit` parity is checked against, for an active number of 1. */
function parityObservations(activeNumber: number): DartObservation[] {
  const index = SECTOR_ORDER.indexOf(activeNumber);
  const n = SECTOR_ORDER.length;
  const neighbours = [
    SECTOR_ORDER[(index - 1 + n) % n]!,
    SECTOR_ORDER[(index + 1) % n]!,
  ];
  return [
    hit(activeNumber, "INNER_SINGLE"),
    hit(activeNumber, "OUTER_SINGLE"),
    hit(activeNumber, "DOUBLE"),
    hit(activeNumber, "TREBLE"),
    hit(neighbours[0]!, "OUTER_SINGLE"),
    hit(neighbours[1]!, "OUTER_SINGLE"),
    hit(25, "OUTER_BULL"),
    hit(25, "INNER_BULL"),
    miss(),
  ];
}

describe("isAimHit parity with each engine's own hit rule", () => {
  const ACTIVE_NUMBER = 1;

  it("Singles Training agrees with applySinglesTrainingDart's own hitsThisVisit delta", () => {
    const targetOrder = targetOrderStartingWith(ACTIVE_NUMBER);
    const wireConfig = singlesConfig({ target_order: targetOrder });
    const decodedConfig = {
      orderMode: "RANDOM",
      targetOrder,
      difficulty: "EASY",
      pointsSingle: 1,
      pointsDouble: 2,
      pointsTreble: 3,
      seats: SEATS,
    };

    for (const observation of parityObservations(ACTIVE_NUMBER)) {
      const rows = rowsFor(
        {
          sessionId: `session-parity-singles-${observation.hitZoneKey}-${observation.hitTargetNumber}`,
          gameTypeKey: "SINGLES_TRAINING",
          rulesetVersionKey: "SINGLES_V1",
          configuration: wireConfig,
        },
        [observation],
      );
      const { sessions } = sessionSteps(rows);
      const [derived] = aimedDarts(sessions[0]!);

      const before = initialSinglesTrainingState(decodedConfig as never)
        .seats[0]!;
      const after = applySinglesTrainingDart(
        decodedConfig as never,
        before,
        observation,
      );
      const expectedHit = after.hitsThisVisit - before.hitsThisVisit === 1;

      expect(derived!.hit).toBe(expectedHit);
    }
  });

  it("Shanghai agrees with zoneBucketOf(zone) !== null on the active number", () => {
    for (const observation of parityObservations(ACTIVE_NUMBER)) {
      const rows = rowsFor(
        {
          sessionId: `session-parity-shanghai-${observation.hitZoneKey}-${observation.hitTargetNumber}`,
          gameTypeKey: "SHANGHAI",
          rulesetVersionKey: "SHANGHAI_V1",
          configuration: shanghaiV1Config(),
        },
        [observation],
      );
      const { sessions } = sessionSteps(rows);
      const [derived] = aimedDarts(sessions[0]!);

      const expectedHit =
        observation.hitTargetNumber === ACTIVE_NUMBER &&
        zoneBucketOf(observation.hitZoneKey) !== null;

      expect(derived!.hit).toBe(expectedHit);
    }
  });

  it("Around the Clock agrees with isClockHit under the ANY segment rule", () => {
    const wireConfig = atcV2Config({ segment_rule: "ANY" });
    const decodedConfig = {
      pathDirection: "LOW_TO_HIGH",
      oddsFirst: false,
      segmentRule: "ANY",
      difficulty: "EASY",
      durationType: "UNTIMED",
      durationValue: null,
      seats: SEATS,
    };

    for (const observation of parityObservations(ACTIVE_NUMBER)) {
      const rows = rowsFor(
        {
          sessionId: `session-parity-atc-${observation.hitZoneKey}-${observation.hitTargetNumber}`,
          gameTypeKey: "AROUND_THE_CLOCK",
          rulesetVersionKey: "AROUND_THE_CLOCK_V2",
          configuration: wireConfig,
        },
        [observation],
      );
      const { sessions } = sessionSteps(rows);
      const [derived] = aimedDarts(sessions[0]!);

      const rules = rulesOf(decodedConfig as never);
      const expectedHit = isClockHit(
        rules,
        { kind: "NUMBER", number: ACTIVE_NUMBER },
        observation,
      );

      expect(derived!.hit).toBe(expectedHit);
    }
  });
});

describe("sessionSteps — skip rules (phase-4 decision 4)", () => {
  it("skips a session whose sessionDartCount is one greater than its actual rows", () => {
    const rows = rowsFor({ sessionId: "session-count-mismatch" }, [
      hit(7, "OUTER_SINGLE"),
      hit(7, "OUTER_SINGLE"),
      hit(7, "OUTER_SINGLE"),
    ]).map((r) => ({ ...r, sessionDartCount: 4 }));

    const { sessions, skippedSessions } = sessionSteps(rows);
    expect(sessions).toEqual([]);
    expect(skippedSessions).toBe(1);
  });

  it("skips a session with a null (undecodable) snapshot", () => {
    const rows = rowsFor(
      { sessionId: "session-no-config", configuration: null },
      [hit(7, "OUTER_SINGLE")],
    );

    const { sessions, skippedSessions } = sessionSteps(rows);
    expect(sessions).toEqual([]);
    expect(skippedSessions).toBe(1);
  });

  it("skips a session whose reducer would throw on a dart fed after a terminal state", () => {
    const clears = Array.from({ length: 20 }, (_, i) =>
      hit(i + 1, "OUTER_SINGLE"),
    );
    const darts = [...clears, hit(25, "OUTER_BULL"), miss()];
    const rows = rowsFor(
      {
        sessionId: "session-atc-overrun",
        gameTypeKey: "AROUND_THE_CLOCK",
        rulesetVersionKey: "AROUND_THE_CLOCK_V1",
        configuration: {},
      },
      darts,
    );

    const { sessions, skippedSessions } = sessionSteps(rows);
    expect(sessions).toEqual([]);
    expect(skippedSessions).toBe(1);
  });

  it("does not let one skipped session suppress the rest of the batch", () => {
    const goodRows = rowsFor({ sessionId: "session-good" }, [
      hit(7, "OUTER_SINGLE"),
      hit(7, "OUTER_SINGLE"),
      hit(7, "OUTER_SINGLE"),
    ]);
    const badRows = rowsFor({ sessionId: "session-bad", configuration: null }, [
      hit(7, "OUTER_SINGLE"),
    ]);

    const { sessions, skippedSessions } = sessionSteps([
      ...badRows,
      ...goodRows,
    ]);
    expect(sessions.map((s) => s.sessionId)).toEqual(["session-good"]);
    expect(skippedSessions).toBe(1);
  });
});
