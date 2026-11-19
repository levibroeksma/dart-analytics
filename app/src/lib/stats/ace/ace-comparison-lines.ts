import { ratioTile } from "@lib/stats/sections/comparison-tile";
import type { AceComparison, TrackTile } from "@lib/types";

/** The three Ace comparison tiles: target hit rate, drift (the largest miss direction's share) and near miss share, each with its change in points once both periods reach `MIN_TARGET_SAMPLE`. */
export function aceComparisonTiles(comparison: AceComparison): TrackTile[] {
  const { direction } = comparison.drift;
  const noMisses =
    comparison.hit.current.whole === 0 ? "No darts yet" : "No misses yet";
  return [
    ratioTile("Target hit rate", comparison.hit, "No darts yet"),
    ratioTile(
      "Drift",
      comparison.drift,
      noMisses,
      direction === null ? "" : `${direction} `,
    ),
    ratioTile("Near miss share", comparison.near, noMisses),
  ];
}
