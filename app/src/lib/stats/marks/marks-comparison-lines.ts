import { meanTile, ratioTile } from "@lib/stats/sections/comparison-tile";
import type { MarksComparison, TrackTile } from "@lib/types";

const NO_DARTS = "No darts yet";

/** The four Marks comparison tiles: marks per round, darts to close out, wasted darts and 1v1 win rate, each with its change once both periods reach `MIN_TARGET_SAMPLE`. */
export function marksComparisonTiles(c: MarksComparison): TrackTile[] {
  return [
    meanTile("Marks per round", c.mpr, NO_DARTS, 2),
    meanTile("Darts to close out", c.close, "No close-outs yet", 1),
    ratioTile("Wasted darts", c.wasted, NO_DARTS),
    ratioTile(
      "Win rate",
      c.wins,
      c.mpr.current.whole === 0 ? NO_DARTS : "Solo games only",
    ),
  ];
}

/** The 1v1 points-per-round tile, or none when the period has no 1v1 darts. */
export function pointsTiles(c: MarksComparison): TrackTile[] {
  if (c.ppr.current.whole === 0) return [];
  return [meanTile("Points per round", c.ppr, NO_DARTS, 1)];
}
