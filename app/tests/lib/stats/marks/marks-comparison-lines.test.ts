import { describe, expect, it } from "vitest";
import {
  marksComparisonTiles,
  pointsTiles,
} from "@lib/stats/marks/marks-comparison-lines";
import type { MarksComparison, Ratio } from "@lib/types";

const r = (part: number, whole: number): Ratio => ({ part, whole });

function comparison(overrides: Partial<MarksComparison> = {}): MarksComparison {
  return {
    mpr: { current: r(27, 9), previous: null },
    close: { current: r(0, 0), previous: null },
    wasted: { current: r(3, 9), previous: null },
    wins: { current: r(0, 0), previous: null },
    ppr: { current: r(0, 0), previous: null },
    ...overrides,
  };
}

describe("marksComparisonTiles", () => {
  it("gives four tiles: marks per round to 2 decimals first", () => {
    const tiles = marksComparisonTiles(comparison());
    expect(tiles.map((t) => t.title)).toEqual([
      "Marks per round",
      "Darts to close out",
      "Wasted darts",
      "Win rate",
    ]);
    expect(tiles[0]!.value).toBe("3.00");
    expect(tiles[2]!.value).toBe("33.3%");
  });

  it("withholds a change below 30 darts", () => {
    const tiles = marksComparisonTiles(
      comparison({ mpr: { current: r(60, 29), previous: r(80, 40) } }),
    );
    expect(tiles[0]!.detail).toBe("No comparison yet");
  });

  it("shows the signed mean change once both periods reach the floor", () => {
    const tiles = marksComparisonTiles(
      comparison({ mpr: { current: r(252, 100), previous: r(240, 100) } }),
    );
    expect(tiles[0]!.detail).toBe("+0.12 vs previous period");
  });

  it("says no close-outs yet, and shows darts to close to 1 decimal", () => {
    expect(marksComparisonTiles(comparison())[1]).toEqual({
      title: "Darts to close out",
      value: "—",
      detail: "No close-outs yet",
    });
    const tiles = marksComparisonTiles(
      comparison({ close: { current: r(45, 2), previous: null } }),
    );
    expect(tiles[1]!.value).toBe("22.5");
  });

  it("marks a period without 1v1 games as solo games only", () => {
    expect(marksComparisonTiles(comparison())[3]).toEqual({
      title: "Win rate",
      value: "—",
      detail: "Solo games only",
    });
  });

  it("shows the win rate over finished 1v1 games", () => {
    const tiles = marksComparisonTiles(
      comparison({ wins: { current: r(3, 4), previous: null } }),
    );
    expect(tiles[3]!.value).toBe("75.0%");
  });
});

describe("marksComparisonTiles with no darts", () => {
  it("says no darts yet under Win rate when the period has none", () => {
    const tiles = marksComparisonTiles(
      comparison({ mpr: { current: r(0, 0), previous: null } }),
    );
    expect(tiles[3]!.detail).toBe("No darts yet");
  });
});

describe("pointsTiles", () => {
  it("is empty without 1v1 darts", () => {
    expect(pointsTiles(comparison())).toEqual([]);
  });

  it("gives one points-per-round tile to 1 decimal", () => {
    expect(
      pointsTiles(comparison({ ppr: { current: r(180, 9), previous: null } })),
    ).toEqual([
      {
        title: "Points per round",
        value: "20.0",
        detail: "No earlier period",
      },
    ]);
  });
});
