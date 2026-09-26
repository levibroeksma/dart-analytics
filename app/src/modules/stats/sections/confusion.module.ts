import { hitKey, intendedKey } from "./intent-cells.module";
import { isClosed } from "./series.module";
import type { ConfusionMetrics, IntentCellRow } from "@modules/types";
import type { SeriesBucket } from "@lib/types";

/**
 * Folds `findIntentCells` rows (queried with `bucket = none`, confusion is
 * not bucketable) into a single landing-distribution bucket per intended
 * target: how often each pair, or a miss, was actually hit.
 */
export function confusionBuckets(
  rows: readonly IntentCellRow[],
  ctx: { to: string; now: Date },
): SeriesBucket<ConfusionMetrics>[] {
  if (rows.length === 0) return [];

  const metrics: ConfusionMetrics = {};
  let sampleSize = 0;

  for (const row of rows) {
    sampleSize += row.darts;
    const key = intendedKey(row);
    const landings = metrics[key] ?? {};
    const landing = hitKey(row);
    landings[landing] = (landings[landing] ?? 0) + row.darts;
    metrics[key] = landings;
  }

  const start = rows[0]!.bucketStart;
  const end = rows[0]!.bucketEnd;

  return [
    {
      start,
      end,
      closed: isClosed(end, ctx.to, ctx.now),
      sampleSize,
      metrics,
    },
  ];
}
