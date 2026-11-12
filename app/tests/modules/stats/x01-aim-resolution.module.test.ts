import { describe, expect, it } from "vitest";
import {
  BOARD_RADII_MM,
  zoneCentroid,
} from "@lib/game/board/board-geometry.module";
import type { BoardPoint } from "@lib/types";
import type { DartZoneKey } from "@modules/types";
import { candidatesFor } from "@modules/stats/x01-aim-candidates.module";
import {
  aimPoint,
  isInferredAimHit,
  resolveAim,
} from "@modules/stats/x01-aim-resolution.module";

function at(zone: DartZoneKey, n: number): BoardPoint {
  return zoneCentroid(n, zone)!;
}

function polar(deg: number, r: number): BoardPoint {
  const radians = deg * (Math.PI / 180);
  return { x: r * Math.sin(radians), y: -r * Math.cos(radians) };
}

function resolve(r: number, dartsLeft: 1 | 2 | 3, point: BoardPoint) {
  return resolveAim(
    candidatesFor({ remaining: r, dartsLeft, earlierDartsInVisit: [] }),
    point,
  );
}

const MID_TREBLE =
  (BOARD_RADII_MM.trebleInner + BOARD_RADII_MM.trebleOuter) / 2;

describe("resolveAim", () => {
  it.each([
    [501, 3, at("TREBLE", 20), "TREBLE:20", "LARGE_TARGET", "NEAREST"],
    [402, 3, at("OUTER_SINGLE", 19), "TREBLE:19", "LARGE_TARGET", "NEAREST"],
    [501, 3, at("OUTER_SINGLE", 5), "TREBLE:20", "LARGE_TARGET", "NEAREST"],
    [496, 2, at("TREBLE", 7), "TREBLE:19", "LARGE_TARGET", "NEAREST"],
    [169, 3, at("TREBLE", 18), "TREBLE:18", "LARGE_TARGET", "NEAREST"],
    [402, 3, polar(10, MID_TREBLE), "TREBLE:20", "LARGE_TARGET", "NEAREST"],
    [18, 3, at("DOUBLE", 9), "DOUBLE:9", "FINISH", "NEAREST"],
    [18, 3, at("OUTER_SINGLE", 14), "DOUBLE:9", "FINISH", "NEAREST"],
    [18, 3, at("OUTER_SINGLE", 2), "SINGLE:2", "SPLIT", "NEAREST"],
    [18, 3, at("OUTER_SINGLE", 15), "SINGLE:2", "SPLIT", "NEAREST"],
    [18, 3, at("OUTER_SINGLE", 10), "SINGLE:2", "SPLIT", "NEAREST"],
    [34, 1, at("OUTER_SINGLE", 2), "SINGLE:2", "SPLIT", "NEAREST"],
    [22, 2, at("OUTER_SINGLE", 10), "WIRE:6-10", "SPLIT", "NEAREST"],
    [22, 2, at("DOUBLE", 11), "DOUBLE:11", "FINISH", "NEAREST"],
    [14, 2, at("OUTER_SINGLE", 6), "WIRE:6-10", "SPLIT", "NEAREST"],
    [50, 3, { x: 0, y: 0 }, "INNER_BULL:25", "FINISH", "NEAREST"],
    [50, 3, at("OUTER_SINGLE", 10), "SINGLE:10", "ROUTE", "NEAREST"],
    [100, 3, at("TREBLE", 19), "TREBLE:20", "ROUTE", "SOLE"],
    [100, 3, at("DOUBLE", 3), "TREBLE:20", "ROUTE", "SOLE"],
    [39, 3, at("DOUBLE", 20), "WIRE:7-19", "ROUTE", "SOLE"],
  ] as const)(
    "resolves %i/%i",
    (r, dartsLeft, point, key, basis, resolution) => {
      const result = resolve(r, dartsLeft, point);
      expect([result.aim?.key, result.basis, result.resolution]).toEqual([
        key,
        basis,
        resolution,
      ]);
    },
  );

  it("marks the centre of the 1 ambiguous", () => {
    expect(resolve(402, 3, at("TREBLE", 1))).toEqual({
      aim: null,
      basis: "LARGE_TARGET",
      resolution: "AMBIGUOUS",
    });
    expect(resolve(402, 3, polar(18, 134.5)).resolution).toBe("AMBIGUOUS");
  });

  it("resolves a dart off the board without a hit", () => {
    const d9 = at("DOUBLE", 9);
    const result = resolve(18, 3, {
      x: d9.x * (185 / 166),
      y: d9.y * (185 / 166),
    });
    expect([result.aim?.key, result.resolution]).toEqual([
      "DOUBLE:9",
      "NEAREST",
    ]);
    expect(isInferredAimHit(result.aim!, null, "MISS")).toBe(false);
  });

  it("judges hits per kind", () => {
    const single = candidatesFor({
      remaining: 41,
      dartsLeft: 2,
      earlierDartsInVisit: [],
    })[0]!.aim;
    expect(isInferredAimHit(single, 9, "INNER_SINGLE")).toBe(true);
    expect(isInferredAimHit(single, 9, "OUTER_SINGLE")).toBe(true);
    expect(isInferredAimHit(single, 9, "TREBLE")).toBe(false);
    const wire = candidatesFor({
      remaining: 48,
      dartsLeft: 3,
      earlierDartsInVisit: [],
    })[0]!.aim;
    expect(isInferredAimHit(wire, 16, "OUTER_SINGLE")).toBe(true);
    expect(isInferredAimHit(wire, 8, "INNER_SINGLE")).toBe(true);
    expect(isInferredAimHit(wire, 7, "OUTER_SINGLE")).toBe(false);
  });

  it("puts aim points where the spec says", () => {
    expect(
      aimPoint(
        candidatesFor({
          remaining: 41,
          dartsLeft: 2,
          earlierDartsInVisit: [],
        })[0]!.aim,
      ),
    ).toEqual(zoneCentroid(9, "OUTER_SINGLE"));
    const wirePoint = aimPoint(
      candidatesFor({
        remaining: 48,
        dartsLeft: 3,
        earlierDartsInVisit: [],
      })[0]!.aim,
    );
    expect(Math.hypot(wirePoint.x, wirePoint.y)).toBeCloseTo(
      (BOARD_RADII_MM.trebleOuter + BOARD_RADII_MM.doubleInner) / 2,
      6,
    );
  });
});
