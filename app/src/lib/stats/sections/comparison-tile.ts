import { MIN_TARGET_SAMPLE } from "@lib/stats/constants";
import { formatPointDelta, formatRate } from "@lib/stats/x01/format";
import type { AceMeasure, Ratio, TrackTile } from "@lib/types";

const rateOf = (ratio: Ratio): number => ratio.part / ratio.whole;

/** Why a measure shows no change — no preceding period, or either period below `MIN_TARGET_SAMPLE` — else `null`. */
function blockedDetail(measure: AceMeasure): string | null {
  const { current, previous } = measure;
  if (previous === null) return "No earlier period";
  if (current.whole < MIN_TARGET_SAMPLE || previous.whole < MIN_TARGET_SAMPLE)
    return "No comparison yet";
  return null;
}

function changeDetail(measure: AceMeasure): string {
  const blocked = blockedDetail(measure);
  if (blocked !== null) return blocked;
  const points = (rateOf(measure.current) - rateOf(measure.previous!)) * 100;
  return `${formatPointDelta(points)} vs previous period`;
}

function signedMean(change: number, decimals: number): string {
  const text = Math.abs(change).toFixed(decimals);
  if (Number(text) === 0) return `±${text}`;
  return `${change > 0 ? "+" : "-"}${text}`;
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

/** A tile for one mean measure: its current `part / whole` to `decimals`, and its signed change under `ratioTile`'s floor and earlier-period rules; `empty` as the detail when the current period has none. */
export function meanTile(
  title: string,
  measure: AceMeasure,
  empty: string,
  decimals: number,
): TrackTile {
  if (measure.current.whole === 0) return { title, value: "—", detail: empty };
  const blocked = blockedDetail(measure);
  const change =
    rateOf(measure.current) - rateOf(measure.previous ?? measure.current);
  return {
    title,
    value: rateOf(measure.current).toFixed(decimals),
    detail: blocked ?? `${signedMean(change, decimals)} vs previous period`,
  };
}
