import { describe, expect, it } from "vitest";
import { BOARD_RADII_MM } from "@lib/game/board/board-geometry.module";
import {
  DARTBOARD_HIGHLIGHT_PATHS,
  HIGHLIGHT_GAP_MM,
  bullOutlinePath,
  wedgeOutlinePath,
} from "@lib/game/board/board-highlight.module";

function radiiIn(d: string): number[] {
  return [...d.matchAll(/A([\d.]+),/g)].map((m) => Number(m[1]));
}

describe("wedgeOutlinePath", () => {
  it("draws the full sector from innerRadiusMm to outerRadiusMm, no internal boundaries", () => {
    const d = wedgeOutlinePath(20, 11.9, 174);
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(radiiIn(d)).toEqual([174, 11.9]);
  });

  it("throws for a number that isn't on the board", () => {
    expect(() => wedgeOutlinePath(21, 11.9, 174)).toThrow();
  });
});

describe("bullOutlinePath", () => {
  it("draws a full circle at the given radius", () => {
    const d = bullOutlinePath(19.9);
    expect(radiiIn(d)).toEqual([19.9, 19.9]);
  });
});

describe("DARTBOARD_HIGHLIGHT_PATHS", () => {
  it("has one entry per board number plus the bull, in sector order with the bull last", () => {
    expect(DARTBOARD_HIGHLIGHT_PATHS.map((p) => p.number)).toEqual([
      20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5, 25,
    ]);
  });

  it("offsets a number's outline outward/inward by HIGHLIGHT_GAP_MM from the scoring boundary", () => {
    const wedge = DARTBOARD_HIGHLIGHT_PATHS.find((p) => p.number === 20)!;
    expect(radiiIn(wedge.d)).toEqual([
      BOARD_RADII_MM.doubleOuter + HIGHLIGHT_GAP_MM,
      BOARD_RADII_MM.outerBull - HIGHLIGHT_GAP_MM,
    ]);
  });

  it("offsets the bull outline outward by HIGHLIGHT_GAP_MM", () => {
    const bull = DARTBOARD_HIGHLIGHT_PATHS.find((p) => p.number === 25)!;
    expect(radiiIn(bull.d)).toEqual([
      BOARD_RADII_MM.outerBull + HIGHLIGHT_GAP_MM,
      BOARD_RADII_MM.outerBull + HIGHLIGHT_GAP_MM,
    ]);
  });
});
