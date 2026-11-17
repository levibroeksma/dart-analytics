import { describe, expect, it } from "vitest";
import {
  BOARD_RADII_MM,
  SECTOR_ORDER,
  SECTOR_WIDTH_DEGREES,
  distanceToBed,
} from "@lib/game/board/board-geometry.module";
import { distanceToAim } from "@lib/game/board/aim-distance.module";

function at(number: number, radius: number) {
  const bearing =
    (SECTOR_ORDER.indexOf(number) * SECTOR_WIDTH_DEGREES * Math.PI) / 180;
  return { x: radius * Math.sin(bearing), y: -radius * Math.cos(bearing) };
}

describe("distanceToAim", () => {
  it("returns 0 for a point inside the aimed double", () => {
    expect(distanceToAim(at(16, 166), { number: 16, zone: "DOUBLE" })).toBe(0);
  });

  it("measures radially past the outer edge of a double", () => {
    const point = at(20, BOARD_RADII_MM.doubleOuter + 15);
    expect(distanceToAim(point, { number: 20, zone: "DOUBLE" })).toBeCloseTo(
      15,
      2,
    );
  });

  it("measures to the wedge edge for a point in the neighbouring double", () => {
    const point = at(1, 166);
    const expected = distanceToBed(
      point,
      20,
      BOARD_RADII_MM.doubleInner,
      BOARD_RADII_MM.doubleOuter,
    );
    expect(expected).toBeGreaterThan(0);
    expect(distanceToAim(point, { number: 20, zone: "DOUBLE" })).toBeCloseTo(
      expected,
      6,
    );
  });

  it("measures a treble aim to the treble band", () => {
    const point = at(20, BOARD_RADII_MM.trebleOuter + 4);
    expect(distanceToAim(point, { number: 20, zone: "TREBLE" })).toBeCloseTo(
      4,
      2,
    );
  });

  it("measures an inner single aim to the inner single band", () => {
    const point = at(20, BOARD_RADII_MM.trebleInner + 3);
    expect(
      distanceToAim(point, { number: 20, zone: "INNER_SINGLE" }),
    ).toBeCloseTo(3, 2);
  });

  it("measures an outer single aim to the outer single band", () => {
    const point = at(20, BOARD_RADII_MM.doubleInner + 5);
    expect(
      distanceToAim(point, { number: 20, zone: "OUTER_SINGLE" }),
    ).toBeCloseTo(5, 2);
  });

  it("measures a whole-number aim across every ring of the wedge", () => {
    expect(distanceToAim(at(20, 103), { number: 20, zone: "NUMBER" })).toBe(0);
    expect(
      distanceToAim(at(20, 175), { number: 20, zone: "NUMBER" }),
    ).toBeCloseTo(5, 2);
  });

  it("measures a bull aim to the whole bull disc", () => {
    expect(distanceToAim({ x: 10, y: 0 }, { number: 25, zone: "BULL" })).toBe(
      0,
    );
    expect(
      distanceToAim({ x: 25, y: 0 }, { number: 25, zone: "BULL" }),
    ).toBeCloseTo(25 - BOARD_RADII_MM.outerBull, 2);
  });

  it("measures an inner bull aim to the inner bull only", () => {
    expect(
      distanceToAim({ x: 10, y: 0 }, { number: 25, zone: "INNER_BULL" }),
    ).toBeCloseTo(10 - BOARD_RADII_MM.innerBull, 2);
  });

  it("measures an outer bull aim to the outer bull ring", () => {
    expect(
      distanceToAim({ x: 10, y: 0 }, { number: 25, zone: "OUTER_BULL" }),
    ).toBe(0);
    expect(
      distanceToAim({ x: 2, y: 0 }, { number: 25, zone: "OUTER_BULL" }),
    ).toBeCloseTo(BOARD_RADII_MM.innerBull - 2, 2);
  });

  it("measures a bare single aim to the nearer of the two single bands", () => {
    expect(
      distanceToAim(at(20, 100), { number: 20, zone: "SINGLE" }),
    ).toBeCloseTo(1, 2);
    expect(distanceToAim(at(20, 130), { number: 20, zone: "SINGLE" })).toBe(0);
  });
});
