import { describe, expect, it } from "vitest";
import { BOARD_RADII_MM } from "@lib/game/board/board-geometry.module";
import {
  BOARD_FACE_RADIUS_MM,
  HIGHLIGHT_GAP_MM,
  bullOutlinePath,
  dartboardDimPath,
  dartboardHighlightPath,
  sectionRingPaths,
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

describe("dartboardDimPath", () => {
  it("is the board face with the active outline cut out", () => {
    expect(dartboardDimPath([20])).toBe(
      bullOutlinePath(BOARD_FACE_RADIUS_MM) + dartboardHighlightPath([20]),
    );
  });

  it("is empty with no active targets, so nothing is dimmed", () => {
    expect(dartboardDimPath([])).toBe("");
  });
});

describe("sectionRingPaths", () => {
  it("draws one track arc per section, with a 2.5° gap at each end", () => {
    const { track } = sectionRingPaths([60, 60, 60, 60], 0, 232);
    expect(track.match(/M/g)).toHaveLength(4);
    expect(track.startsWith("M")).toBe(true);
  });

  it("draws no fill before the run starts", () => {
    expect(sectionRingPaths([60, 60], 0, 232).fill).toBe("");
  });

  it("fills completed sections whole and the running one in part", () => {
    const { fill } = sectionRingPaths([60, 60, 60], 90, 232);
    expect(fill.match(/M/g)).toHaveLength(2);
  });

  it("fills every section once elapsed reaches the total", () => {
    const { track, fill } = sectionRingPaths([60, 60], 120, 232);
    expect(fill).toBe(track);
  });

  it("splits the ring by duration, not evenly", () => {
    const even = sectionRingPaths([60, 60], 0, 232).track;
    const weighted = sectionRingPaths([30, 90], 0, 232).track;
    expect(weighted).not.toBe(even);
  });

  function arcs(path: string): string[] {
    return path.split("M").filter(Boolean);
  }

  function endAngle(arc: string): number {
    const numbers = arc.split(/[A,]/).map(Number);
    const x = numbers[numbers.length - 2];
    const y = numbers[numbers.length - 1];
    return ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360;
  }

  it("starts the first arc at 12 o'clock plus the 2.5° gap", () => {
    const radians = (2.5 * Math.PI) / 180;
    const x = Math.round(232 * Math.sin(radians) * 1000) / 1000;
    const y = Math.round(-232 * Math.cos(radians) * 1000) / 1000;
    const { track } = sectionRingPaths([60, 60], 0, 232);
    expect(track.startsWith(`M${x},${y}A`)).toBe(true);
  });

  it("draws no arc for a section shorter than its two gaps", () => {
    const { track, fill } = sectionRingPaths([5, 715], 5, 232);
    expect(arcs(track)).toHaveLength(1);
    expect(fill).toBe("");
  });

  it("draws no arc for a section with no duration", () => {
    const { track } = sectionRingPaths([0, 60], 0, 232);
    expect(arcs(track)).toHaveLength(1);
  });

  it("ends a partial fill before its own section's track end", () => {
    const { track, fill } = sectionRingPaths([60, 60, 60, 60], 90, 232);
    const running = arcs(fill)[1];
    const section = arcs(track)[1];
    expect(running.split("A")[0]).toBe(section.split("A")[0]);
    expect(endAngle(running)).toBeCloseTo(135, 1);
    expect(endAngle(running)).toBeLessThan(endAngle(section));
  });
});
