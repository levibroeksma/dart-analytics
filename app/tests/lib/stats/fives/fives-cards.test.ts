import { describe, it, expect } from "vitest";
import {
  fivesCard,
  fivesTiles,
  visitOutcomeRows,
} from "@lib/stats/fives/fives-cards";
import { fivesComparison } from "@lib/stats/fives/fives-comparison";
import { formatRate } from "@lib/stats/x01/format";
import { emptyFivesMetrics } from "@modules/stats/sections/fives.module";

describe("fivesTiles", () => {
  it("lists the four tiles in order", () => {
    const c = fivesComparison(emptyFivesMetrics(), null);
    expect(fivesTiles(c).map((tile) => tile.title)).toEqual([
      "Win rate",
      "Scoring visit rate",
      "Points per visit",
      "Visits per win",
    ]);
  });

  it("shows the empty copy and no NaN with nothing counted", () => {
    const tiles = fivesTiles(fivesComparison(emptyFivesMetrics(), null));
    expect(tiles.map((tile) => tile.detail)).toEqual([
      "No finished games yet",
      "No visits yet",
      "No visits yet",
      "No wins",
    ]);
    expect(JSON.stringify(tiles)).not.toContain("NaN");
  });

  it("withholds the scoring rate change below 30 visits in a period", () => {
    const few = { ...emptyFivesMetrics(), visits: 29, scoringVisits: 10 };
    const many = { ...emptyFivesMetrics(), visits: 40, scoringVisits: 20 };
    expect(fivesTiles(fivesComparison(many, few))[1]!.detail).toBe(
      "No comparison yet",
    );
    expect(fivesTiles(fivesComparison(few, many))[1]!.detail).toBe(
      "No comparison yet",
    );
  });
});

describe("visitOutcomeRows", () => {
  it("splits visits into four outcomes whose counts and shares sum to the whole", () => {
    const rows = visitOutcomeRows({
      ...emptyFivesMetrics(),
      visits: 10,
      scoringVisits: 4,
      voids: 2,
      busts: 1,
    });
    expect(rows.map((row) => [row.label, row.count])).toEqual([
      ["Scored", 4],
      ["No five", 3],
      ["Void", 2],
      ["Bust", 1],
    ]);
    expect(rows.reduce((sum, row) => sum + row.count, 0)).toBe(10);
    expect(rows.map((row) => row.cells[0])).toEqual([
      formatRate(0.4),
      formatRate(0.3),
      formatRate(0.2),
      formatRate(0.1),
    ]);
  });

  it("shows no share with no visits", () => {
    const rows = visitOutcomeRows(emptyFivesMetrics());
    expect(rows.map((row) => row.cells[0])).toEqual(
      Array(4).fill(formatRate(null)),
    );
  });
});

describe("fivesCard", () => {
  it("holds the comparison and the current period's outcome rows", () => {
    const current = { ...emptyFivesMetrics(), visits: 2, scoringVisits: 2 };
    const card = fivesCard(current, null);
    expect(card.comparison.scoringRate.current).toEqual({ part: 2, whole: 2 });
    expect(card.outcomes[0]!.count).toBe(2);
  });
});
