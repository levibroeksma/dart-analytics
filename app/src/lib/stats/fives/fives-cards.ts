import { meanTile, ratioTile } from "@lib/stats/sections/comparison-tile";
import { formatRate } from "@lib/stats/x01/format";
import { fivesComparison } from "./fives-comparison";
import type {
  AimTableRow,
  FivesCard,
  FivesComparison,
  TrackTile,
} from "@lib/types";
import type { FivesMetrics } from "@modules/types";

const NO_VISITS = "No visits yet";

/** The four comparison tiles, each with its change once both periods reach `MIN_TARGET_SAMPLE`. */
export function fivesTiles(c: FivesComparison): TrackTile[] {
  return [
    ratioTile("Win rate", c.wins, "No finished games yet"),
    ratioTile("Scoring visit rate", c.scoringRate, NO_VISITS),
    meanTile("Points per visit", c.pointsPerVisit, NO_VISITS, 1),
    meanTile("Visits per win", c.visitsPerWin, "No wins", 1),
  ];
}

/** One row per visit outcome (Scored, No five, Void, Bust): visits as the count, the share of all visits as the cell. */
export function visitOutcomeRows(m: FivesMetrics): AimTableRow[] {
  const noFive = m.visits - m.scoringVisits - m.voids - m.busts;
  const outcomes: [string, number][] = [
    ["Scored", m.scoringVisits],
    ["No five", noFive],
    ["Void", m.voids],
    ["Bust", m.busts],
  ];
  return outcomes.map(([label, count]) => ({
    label,
    count,
    cells: [formatRate(m.visits > 0 ? count / m.visits : null)],
  }));
}

/** The card for the current period against the previous one: comparison and the current period's visit outcome rows. */
export function fivesCard(
  current: FivesMetrics,
  previous: FivesMetrics | null,
): FivesCard {
  return {
    comparison: fivesComparison(current, previous),
    outcomes: visitOutcomeRows(current),
  };
}
