import { MIN_TARGET_SAMPLE } from "@lib/stats/constants";
import { formatPointDelta, formatRate } from "@lib/stats/x01/format";
import type { AceComparison, AceMeasure, Ratio, TrackTile } from "@lib/types";

const rateOf = (ratio: Ratio): number => ratio.part / ratio.whole;

function changeDetail(measure: AceMeasure): string {
  const { current, previous } = measure;
  if (previous === null) return "No earlier period";
  if (current.whole < MIN_TARGET_SAMPLE || previous.whole < MIN_TARGET_SAMPLE)
    return "No comparison yet";
  const points = (rateOf(current) - rateOf(previous)) * 100;
  return `${formatPointDelta(points)} vs previous period`;
}

function measureTile(
  title: string,
  measure: AceMeasure,
  empty: string,
  prefix = "",
): TrackTile {
  if (measure.current.whole === 0)
    return { title, value: formatRate(null), detail: empty };
  return {
    title,
    value: `${prefix}${formatRate(rateOf(measure.current))}`,
    detail: changeDetail(measure),
  };
}

/** The three Ace comparison tiles: target hit rate, drift (the largest miss direction's share) and near miss share, each with its change in points once both periods reach `MIN_TARGET_SAMPLE`. */
export function aceComparisonTiles(comparison: AceComparison): TrackTile[] {
  const { direction } = comparison.drift;
  const noMisses =
    comparison.hit.current.whole === 0 ? "No darts yet" : "No misses yet";
  return [
    measureTile("Target hit rate", comparison.hit, "No darts yet"),
    measureTile(
      "Drift",
      comparison.drift,
      noMisses,
      direction === null ? "" : `${direction} `,
    ),
    measureTile("Near miss share", comparison.near, noMisses),
  ];
}
