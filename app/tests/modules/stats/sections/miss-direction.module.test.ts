import { describe, it, expect } from "vitest";
import {
  missDirectionBuckets,
  missReferences,
  missSector,
} from "@modules/stats/sections/miss-direction.module";
import { zoneCentroid } from "@lib/game/board/board-geometry.module";
import type { MissSectorRow } from "@modules/types";

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
