import { describe, expect, it } from "vitest";
import { objectiveRows, ringRows } from "@lib/stats/marks/marks-cards";
import type { MarksMetrics } from "@modules/types";

function metrics(overrides: Partial<MarksMetrics> = {}): MarksMetrics {
  return {
    darts: 0,
    marks: 0,
    wasted: 0,
    rings: { single: 0, double: 0, treble: 0 },
    objectives: [],
    closeOuts: { games: 0, darts: 0 },
    duel: { games: 0, wins: 0, darts: 0, points: 0 },
    ...overrides,
  };
}

describe("objectiveRows", () => {
  it("labels each objective in the metrics' order", () => {
    const rows = objectiveRows(
      metrics({
        objectives: [
          { key: "20", marks: 3, darts: 2 },
          { key: "BULL", marks: 1, darts: 1 },
          { key: "DOUBLES", marks: 0, darts: 0 },
          { key: "TRIPLES", marks: 2, darts: 2 },
        ],
      }),
    );
    expect(rows).toEqual([
      { label: "20", count: 2, cells: ["3"] },
      { label: "Bull", count: 1, cells: ["1"] },
      { label: "Doubles", count: 0, cells: ["0"] },
      { label: "Triples", count: 2, cells: ["2"] },
    ]);
  });
});

describe("ringRows", () => {
  it("shows each ring's share of marking darts from 10", () => {
    const rows = ringRows(
      metrics({ rings: { single: 5, double: 1, treble: 4 } }),
    );
    expect(rows).toEqual([
      { label: "Single", count: 5, cells: ["50.0%"] },
      { label: "Double", count: 1, cells: ["10.0%"] },
      { label: "Treble", count: 4, cells: ["40.0%"] },
    ]);
  });

  it("withholds the share below 10 marking darts", () => {
    const rows = ringRows(
      metrics({ rings: { single: 5, double: 1, treble: 3 } }),
    );
    expect(rows.map((row) => row.cells[0])).toEqual(["—", "—", "—"]);
  });
});
