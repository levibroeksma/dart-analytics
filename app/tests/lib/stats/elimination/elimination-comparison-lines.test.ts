import { describe, expect, it } from "vitest";
import { eliminationTiles } from "@lib/stats/elimination/elimination-comparison-lines";
import { eliminationComparison } from "@lib/stats/elimination/elimination-comparison";
import { emptyEliminationMetrics } from "@modules/stats/sections/elimination.module";

const EMPTY = eliminationComparison(
  emptyEliminationMetrics(),
  emptyEliminationMetrics(),
);

describe("eliminationTiles", () => {
  it("gives each game its four tiles, win rate first", () => {
    expect(eliminationTiles("KILLER", EMPTY).map((t) => t.title)).toEqual([
      "Win rate",
      "Darts to Killer",
      "Darts per life taken",
      "Lives lost per game",
    ]);
    expect(
      eliminationTiles("FOLLOW_THE_LEADER", EMPTY).map((t) => t.title),
    ).toEqual([
      "Win rate",
      "Match rate",
      "Darts per match",
      "Lives lost per game",
    ]);
    expect(eliminationTiles("PRISONER", EMPTY).map((t) => t.title)).toEqual([
      "Win rate",
      "Advance rate",
      "Prison rate",
      "Numbers completed per game",
    ]);
  });

  it("shows empty texts and no NaN for an empty period", () => {
    const killer = eliminationTiles("KILLER", EMPTY);
    expect(killer.map((t) => t.detail)).toEqual([
      "No finished games yet",
      "Not a Killer yet",
      "No lives taken",
      "No finished games yet",
    ]);
    const all = [
      ...killer,
      ...eliminationTiles("FOLLOW_THE_LEADER", EMPTY),
      ...eliminationTiles("PRISONER", EMPTY),
    ];
    for (const tile of all) expect(tile.value).not.toContain("NaN");
    expect(
      eliminationTiles("FOLLOW_THE_LEADER", EMPTY).map((t) => t.detail),
    ).toEqual([
      "No finished games yet",
      "No match visits yet",
      "No matches yet",
      "No finished games yet",
    ]);
    expect(eliminationTiles("PRISONER", EMPTY).map((t) => t.detail)).toEqual([
      "No finished games yet",
      "No darts yet",
      "No darts yet",
      "No finished games yet",
    ]);
  });

  it("withholds the change below 30 match visits in either period", () => {
    const at = (visits: number) => {
      const m = emptyEliminationMetrics();
      m.followTheLeader.matchVisits = visits;
      m.followTheLeader.matched = 10;
      return m;
    };
    const rate = (current: number, previous: number) =>
      eliminationTiles(
        "FOLLOW_THE_LEADER",
        eliminationComparison(at(current), at(previous)),
      )[1]!.detail;
    expect(rate(29, 40)).toBe("No comparison yet");
    expect(rate(40, 29)).toBe("No comparison yet");
    expect(rate(40, 40)).toContain("vs previous period");
  });
});
