import { MIN_TARGET_SAMPLE } from "@lib/stats/constants";
import { formatPointDelta, formatRate } from "@lib/stats/x01/format";
import type { AceMeasure, Ratio, TrackTile } from "@lib/types";

const rateOf = (ratio: Ratio): number => ratio.part / ratio.whole;

function changeDetail(measure: AceMeasure): string {
  const { current, previous } = measure;
  if (previous === null) return "No earlier period";
  if (current.whole < MIN_TARGET_SAMPLE || previous.whole < MIN_TARGET_SAMPLE)
    return "No comparison yet";
  const points = (rateOf(current) - rateOf(previous)) * 100;
  return `${formatPointDelta(points)} vs previous period`;
}

/** A tile for one ratio measure: its current rate (after `prefix`) and its change in points against the preceding period once both reach `MIN_TARGET_SAMPLE`; `empty` as the detail when the current period has none. */
export function ratioTile(
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
