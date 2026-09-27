import { describe, it, expect } from "vitest";
import {
  aimCellRows,
  intendedKey,
  hitKey,
  isHit,
} from "@modules/stats/sections/intent-cells.module";
import { targetAccuracyBuckets } from "@modules/stats/sections/target-accuracy.module";
import { sessionSteps } from "@modules/stats/derived-aims.module";
import { isHitOn } from "@modules/game/board-progression.module";
import type {
  BoardTarget,
  DartFoldRow,
  DartObservation,
  DartZoneKey,
  IntentCellRow,
} from "@modules/types";

function row(overrides: Partial<IntentCellRow>): IntentCellRow {
  return {
    bucketStart: "2026-01-01T00:00:00.000Z",
    bucketEnd: "2026-02-01T00:00:00.000Z",
    intendedTargetNumber: 16,
    intendedZoneKey: "DOUBLE",
    hitTargetNumber: 16,
    hitZoneKey: "DOUBLE",
    darts: 1,
    ...overrides,
  };
}

describe("intendedKey / hitKey", () => {
  it("formats the intended pair as a TargetKey", () => {
    expect(intendedKey(row({}))).toBe("DOUBLE:16");
    expect(
      intendedKey(
        row({ intendedTargetNumber: 25, intendedZoneKey: "INNER_BULL" }),
      ),
    ).toBe("INNER_BULL:25");
  });

  it("formats a MISS hit as the literal MISS", () => {
    expect(hitKey(row({ hitTargetNumber: null, hitZoneKey: "MISS" }))).toBe(
      "MISS",
    );
  });

  it("formats a non-miss hit as a TargetKey", () => {
    expect(
      hitKey(row({ hitTargetNumber: 8, hitZoneKey: "OUTER_SINGLE" })),
    ).toBe("OUTER_SINGLE:8");
  });
});

describe("isHit parity with isHitOn", () => {
  const observations: DartObservation[] = [
    {
      hitTargetNumber: 16,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    },
    {
      hitTargetNumber: 16,
      hitZoneKey: "OUTER_SINGLE",
      locationX: null,
      locationY: null,
    },
    {
      hitTargetNumber: 16,
      hitZoneKey: "TREBLE",
      locationX: null,
      locationY: null,
    },
    {
      hitTargetNumber: 16,
      hitZoneKey: "INNER_SINGLE",
      locationX: null,
      locationY: null,
    },
    {
      hitTargetNumber: 8,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    },
    {
      hitTargetNumber: 25,
      hitZoneKey: "INNER_BULL",
      locationX: null,
      locationY: null,
    },
    {
      hitTargetNumber: 25,
      hitZoneKey: "OUTER_BULL",
      locationX: null,
      locationY: null,
    },
    {
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    },
  ];

  it("agrees with isHitOn for every intended pair these engines store", () => {
    const intents: {
      target: BoardTarget;
      targetNumber: number;
      zoneKey: string;
    }[] = [
      ...Array.from({ length: 20 }, (_, i) => ({
        target: { kind: "DOUBLE", number: i + 1 } as BoardTarget,
        targetNumber: i + 1,
        zoneKey: "DOUBLE",
      })),
      {
        target: { kind: "BULL" } as BoardTarget,
        targetNumber: 25,
        zoneKey: "INNER_BULL",
      },
    ];

    for (const intent of intents) {
      for (const observation of observations) {
        const cellRow = row({
          intendedTargetNumber: intent.targetNumber,
          intendedZoneKey: intent.zoneKey,
          hitTargetNumber: observation.hitTargetNumber,
          hitZoneKey: observation.hitZoneKey,
        });
        expect(isHit(cellRow)).toBe(isHitOn(intent.target, observation));
      }
    }
  });
});

describe("isHit — derived aim zones (phase-4 decision 2)", () => {
  it("treats any ring except MISS as a hit under a NUMBER aim", () => {
    expect(
      isHit(
        row({
          intendedTargetNumber: 20,
          intendedZoneKey: "NUMBER",
          hitTargetNumber: 20,
          hitZoneKey: "TREBLE",
        }),
      ),
    ).toBe(true);
    expect(
      isHit(
        row({
          intendedTargetNumber: 20,
          intendedZoneKey: "NUMBER",
          hitTargetNumber: 1,
          hitZoneKey: "OUTER_SINGLE",
        }),
      ),
    ).toBe(false);
    expect(
      isHit(
        row({
          intendedTargetNumber: 20,
          intendedZoneKey: "NUMBER",
          hitTargetNumber: null,
          hitZoneKey: "MISS",
        }),
      ),
    ).toBe(false);
  });

  it("treats either bull ring as a hit under a BULL aim", () => {
    expect(
      isHit(
        row({
          intendedTargetNumber: 25,
          intendedZoneKey: "BULL",
          hitTargetNumber: 25,
          hitZoneKey: "OUTER_BULL",
        }),
      ),
    ).toBe(true);
  });
});

const AIM_CELL_SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "HOME",
    participantTypeKey: "PLAYER",
  },
];

/** A 21-length `target_order` (Singles' schema) starting with `first`. */
function targetOrderStartingWith(first: number): number[] {
  const rest = Array.from({ length: 20 }, (_, i) => i + 1).filter(
    (n) => n !== first,
  );
  return [first, ...rest, 25];
}

let aimCellRowSeq = 0;

function aimCellFoldRow(overrides: Partial<DartFoldRow>): DartFoldRow {
  aimCellRowSeq += 1;
  return {
    sessionId: "session-aim-cells",
    gameTypeKey: "SINGLES_TRAINING",
    rulesetVersionKey: "SINGLES_V1",
    configuration: {
      order_mode: "RANDOM",
      target_order: targetOrderStartingWith(20),
      difficulty: "EASY",
      points_single: 1,
      points_double: 2,
      points_treble: 3,
      seats: AIM_CELL_SEATS,
    },
    sessionDartCount: 3,
    bucketStart: "2026-09-01T00:00:00.000Z",
    bucketEnd: "2026-10-01T00:00:00.000Z",
    turnSequence: aimCellRowSeq,
    dartNumber: 1,
    hitTargetNumber: 20,
    hitZoneKey: "TREBLE",
    intendedTargetNumber: null,
    intendedZoneKey: null,
    locationX: 0,
    locationY: 0,
    ...overrides,
  };
}

function aimCellRowsFor(darts: readonly DartObservation[]): DartFoldRow[] {
  return darts.map((observation) =>
    aimCellFoldRow({
      sessionDartCount: darts.length,
      hitTargetNumber: observation.hitTargetNumber,
      hitZoneKey: observation.hitZoneKey,
      locationX: observation.locationX,
      locationY: observation.locationY,
    }),
  );
}

function aimCellHit(number: number, zone: DartZoneKey): DartObservation {
  return {
    hitTargetNumber: number,
    hitZoneKey: zone,
    locationX: 0,
    locationY: 0,
  };
}

describe("aimCellRows", () => {
  it("carries NUMBER on the intended_zone_key column", () => {
    const rows = aimCellRowsFor([aimCellHit(20, "TREBLE")]);
    const { sessions } = sessionSteps(rows);

    const [cell] = aimCellRows(sessions);
    expect(cell!.intendedZoneKey).toBe("NUMBER");
    expect(cell!.intendedTargetNumber).toBe(20);
  });

  it("fed to targetAccuracyBuckets gives NUMBER:20 a 2/3 hit ratio for T20, S20, S1", () => {
    const rows = aimCellRowsFor([
      aimCellHit(20, "TREBLE"),
      aimCellHit(20, "OUTER_SINGLE"),
      aimCellHit(1, "OUTER_SINGLE"),
    ]);

    const { sessions, skippedSessions } = sessionSteps(rows);
    expect(skippedSessions).toBe(0);

    const cellRows = aimCellRows(sessions);
    const [bucket] = targetAccuracyBuckets(cellRows, {
      to: "2026-10-01T00:00:00.000Z",
      now: new Date("2026-10-02T00:00:00.000Z"),
    });

    expect(bucket!.metrics["NUMBER:20"]).toEqual({ attempts: 3, hits: 2 });
  });
});
