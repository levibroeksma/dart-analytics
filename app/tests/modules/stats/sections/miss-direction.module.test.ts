import { describe, it, expect } from "vitest";
import {
  aimMissRows,
  missDirectionBuckets,
  missReferences,
  missSector,
  radialClass,
} from "@modules/stats/sections/miss-direction.module";
import { sessionSteps } from "@modules/stats/derived-aims.module";
import {
  BOARD_RADII_MM,
  zoneCentroid,
} from "@lib/game/board/board-geometry.module";
import type {
  DartFoldRow,
  DartObservation,
  MissSectorRow,
} from "@modules/types";

function bearingToDelta(bearingDegrees: number): { dx: number; dy: number } {
  const radians = (bearingDegrees * Math.PI) / 180;
  return { dx: Math.sin(radians), dy: -Math.cos(radians) };
}

describe("missSector", () => {
  it("agrees with the bearing-to-sector mapping at the sector boundaries", () => {
    const cases: [number, number][] = [
      [0, 0],
      [22.4, 0],
      [22.5, 1],
      [180, 4],
      [337.5, 0],
    ];
    for (const [bearing, expected] of cases) {
      const { dx, dy } = bearingToDelta(bearing);
      expect(missSector(dx, dy)).toBe(expected);
    }
  });
});

describe("missReferences", () => {
  const refs = missReferences();

  it("has 82 rows (20 numbered rings x 4 zones, plus 2 bulls)", () => {
    expect(refs).toHaveLength(82);
  });

  it("gives DOUBLE:20 the geometric centroid and 162/170 radii", () => {
    const ref = refs.find(
      (r) => r.targetNumber === 20 && r.zoneKey === "DOUBLE",
    )!;
    const centroid = zoneCentroid(20, "DOUBLE")!;
    expect(ref.cx).toBeCloseTo(centroid.x);
    expect(ref.cy).toBeCloseTo(centroid.y);
    expect(ref.rInner).toBe(162);
    expect(ref.rOuter).toBe(170);
  });

  it("includes both bulls at radii 0/6.35 and 6.35/15.9", () => {
    const inner = refs.find(
      (r) => r.targetNumber === 25 && r.zoneKey === "INNER_BULL",
    )!;
    const outer = refs.find(
      (r) => r.targetNumber === 25 && r.zoneKey === "OUTER_BULL",
    )!;
    expect(inner.rInner).toBe(0);
    expect(inner.rOuter).toBe(6.35);
    expect(outer.rInner).toBe(6.35);
    expect(outer.rOuter).toBe(15.9);
  });
});

describe("missDirectionBuckets", () => {
  function row(overrides: Partial<MissSectorRow>): MissSectorRow {
    return {
      targetNumber: 16,
      zoneKey: "DOUBLE",
      sector: 0,
      radial: "WITHIN",
      darts: 1,
      ...overrides,
    };
  }

  it("groups sector/radial entries by target into a single bucket", () => {
    const rows = [
      row({ sector: 0, radial: "WITHIN", darts: 5 }),
      row({ sector: 4, radial: "OUTSIDE", darts: 2 }),
    ];

    const [bucket] = missDirectionBuckets(rows, {
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-02-01T00:00:00.000Z",
      now: new Date("2026-03-01T00:00:00.000Z"),
    });

    expect(bucket.metrics["DOUBLE:16"]).toEqual([
      { sector: 0, radial: "WITHIN", darts: 5 },
      { sector: 4, radial: "OUTSIDE", darts: 2 },
    ]);
    expect(bucket.sampleSize).toBe(7);
  });

  it("returns no buckets for an empty row set", () => {
    expect(
      missDirectionBuckets([], {
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-02-01T00:00:00.000Z",
        now: new Date(),
      }),
    ).toEqual([]);
  });
});

describe("radialClass", () => {
  it("agrees with the SQL CASE at each boundary (>= on rOuter)", () => {
    const rInner = BOARD_RADII_MM.outerBull;
    const rOuter = BOARD_RADII_MM.doubleOuter;

    expect(radialClass(rInner - 0.01, rInner, rOuter)).toBe("INSIDE");
    expect(radialClass(rInner, rInner, rOuter)).toBe("WITHIN");
    expect(radialClass(rOuter - 0.01, rInner, rOuter)).toBe("WITHIN");
    expect(radialClass(rOuter, rInner, rOuter)).toBe("OUTSIDE");
  });
});

const AIM_MISS_SEATS = [
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

let aimMissRowSeq = 0;

function aimMissFoldRow(overrides: Partial<DartFoldRow>): DartFoldRow {
  aimMissRowSeq += 1;
  return {
    sessionId: "session-aim-miss",
    gameTypeKey: "SINGLES_TRAINING",
    rulesetVersionKey: "SINGLES_V1",
    configuration: {
      order_mode: "RANDOM",
      target_order: targetOrderStartingWith(20),
      difficulty: "EASY",
      points_single: 1,
      points_double: 2,
      points_treble: 3,
      seats: AIM_MISS_SEATS,
    },
    sessionDartCount: 2,
    bucketStart: "2026-09-01T00:00:00.000Z",
    bucketEnd: "2026-10-01T00:00:00.000Z",
    turnSequence: aimMissRowSeq,
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

function aimMissRowsFor(darts: readonly DartObservation[]): DartFoldRow[] {
  return darts.map((observation) =>
    aimMissFoldRow({
      sessionDartCount: darts.length,
      hitTargetNumber: observation.hitTargetNumber,
      hitZoneKey: observation.hitZoneKey,
      locationX: observation.locationX,
      locationY: observation.locationY,
    }),
  );
}

describe("aimMissRows", () => {
  it("a dart aimed at NUMBER:20 landing in the 1 wedge is sector 2 or 3 and WITHIN, and hits are excluded", () => {
    const landing = zoneCentroid(1, "OUTER_SINGLE")!;
    const darts: DartObservation[] = [
      {
        hitTargetNumber: 1,
        hitZoneKey: "OUTER_SINGLE",
        locationX: landing.x,
        locationY: landing.y,
      },
      {
        hitTargetNumber: 20,
        hitZoneKey: "TREBLE",
        locationX: 0,
        locationY: -103,
      },
    ];
    const { sessions, skippedSessions } = sessionSteps(aimMissRowsFor(darts));
    expect(skippedSessions).toBe(0);

    const rows = aimMissRows(sessions);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.targetNumber).toBe(20);
    expect(rows[0]!.zoneKey).toBe("NUMBER");
    expect(rows[0]!.darts).toBe(1);
    expect([2, 3]).toContain(rows[0]!.sector);
    expect(rows[0]!.radial).toBe("WITHIN");
  });
});
