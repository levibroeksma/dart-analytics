import { MIN_TARGET_SAMPLE } from "@lib/stats/constants";
import { formatPointDelta, formatRate } from "@lib/stats/x01/format";
import type { AceComparison, AceMeasure, Ratio, TrackTile } from "@lib/types";

const rateOf = (ratio: Ratio): number => ratio.part / ratio.whole;

function changeDetail(measure: AceMeasure): string {
  const { current, previous } = measure;
  if (
    previous === null ||
    current.whole < MIN_TARGET_SAMPLE ||
    previous.whole < MIN_TARGET_SAMPLE
  )
    return "No comparison yet";
  const points = (rateOf(current) - rateOf(previous)) * 100;
  return `${formatPointDelta(points)} vs previous period`;
}

function measureTile(
  title: string,
  measure: AceMeasure,
  prefix = "",
): TrackTile {
  if (measure.current.whole === 0)
    return { title, value: formatRate(null), detail: "No darts yet" };
  return {
    title,
    value: `${prefix}${formatRate(rateOf(measure.current))}`,
    detail: changeDetail(measure),
  };
}

/** The three Ace comparison tiles: target hit rate, drift (the largest miss direction's share) and near miss share, each with its change in points once both periods reach `MIN_TARGET_SAMPLE`. */
export function aceComparisonTiles(comparison: AceComparison): TrackTile[] {
  const { direction } = comparison.drift;
  return [
    measureTile("Target hit rate", comparison.hit),
    measureTile(
      "Drift",
      comparison.drift,
      direction === null ? "" : `${direction} `,
    ),
    measureTile("Near miss share", comparison.near),
  ];
}
