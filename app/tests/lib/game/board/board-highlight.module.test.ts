import { describe, expect, it } from "vitest";
import { BOARD_RADII_MM } from "@lib/game/board/board-geometry.module";
import {
  HIGHLIGHT_GAP_MM,
  bullOutlinePath,
  dartboardHighlightPath,
  sectorGroupOutlinePath,
} from "@lib/game/board/board-highlight.module";

function radiiIn(d: string): number[] {
  return [...d.matchAll(/A([\d.]+),/g)].map((m) => Number(m[1]));
}

describe("sectorGroupOutlinePath", () => {
  it("draws the full perimeter of a single number: outer arc, both radial edges, inner arc", () => {
    const d = sectorGroupOutlinePath([20], 11.9, 174);
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(d.includes("L")).toBe(true);
    expect(radiiIn(d)).toEqual([174, 11.9]);
  });

  it("merges an adjacent group into one outline, dropping internal boundaries", () => {
    const single = sectorGroupOutlinePath([20], 11.9, 174);
    const group = sectorGroupOutlinePath([5, 20, 1], 11.9, 174);
    expect(group).not.toBe(single);
    expect(radiiIn(group)).toEqual([174, 11.9]);
  });

  it("produces the same outline regardless of input order (5, 20, 1 wraps across index 0)", () => {
    const forward = sectorGroupOutlinePath([5, 20, 1], 11.9, 174);
    const shuffled = sectorGroupOutlinePath([1, 5, 20], 11.9, 174);
    expect(shuffled).toBe(forward);
  });

  it("throws for a number that isn't on the board", () => {
    expect(() => sectorGroupOutlinePath([21], 11.9, 174)).toThrow();
  });
});

describe("bullOutlinePath", () => {
  it("draws a full circle at the given radius", () => {
    const d = bullOutlinePath(19.9);
    expect(radiiIn(d)).toEqual([19.9, 19.9]);
  });
});

describe("dartboardHighlightPath", () => {
  it("returns empty for no active targets", () => {
    expect(dartboardHighlightPath([])).toBe("");
  });

  it("draws the bull's own ring, offset outward by HIGHLIGHT_GAP_MM", () => {
    const d = dartboardHighlightPath([25]);
    expect(radiiIn(d)).toEqual([
      BOARD_RADII_MM.outerBull + HIGHLIGHT_GAP_MM,
      BOARD_RADII_MM.outerBull + HIGHLIGHT_GAP_MM,
    ]);
  });

  it("draws the merged sector-group perimeter, offset outward/inward by HIGHLIGHT_GAP_MM", () => {
    const d = dartboardHighlightPath([5, 20, 1]);
    expect(radiiIn(d)).toEqual([
      BOARD_RADII_MM.doubleOuter + HIGHLIGHT_GAP_MM,
      BOARD_RADII_MM.outerBull - HIGHLIGHT_GAP_MM,
    ]);
  });
});
