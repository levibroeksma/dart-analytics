import { intendedKey } from "./intent-cells.module";
import { bucketFor, closeBuckets } from "./series.module";
import type { SeriesBucket } from "@lib/types";
import type { GroupingMetrics, IntentMomentRow } from "@modules/types";

/** Folds `findIntentMoments` rows into `grouping` buckets: summed position moments per intended target. */
export function groupingBuckets(
  rows: readonly IntentMomentRow[],
  ctx: { to: string; now: Date },
): SeriesBucket<GroupingMetrics>[] {
  const buckets = new Map<
    string,
    { end: string; metrics: GroupingMetrics; sampleSize: number }
  >();

  for (const row of rows) {
    const bucket = bucketFor(buckets, row, () => ({}));
    bucket.sampleSize += row.n;

    const key = intendedKey(row);
    const existing = bucket.metrics[key] ?? {
      n: 0,
      sumX: 0,
      sumY: 0,
      sumXX: 0,
      sumYY: 0,
      sumXY: 0,
    };
    existing.n += row.n;
    existing.sumX += row.sumX;
    existing.sumY += row.sumY;
    existing.sumXX += row.sumXX;
    existing.sumYY += row.sumYY;
    existing.sumXY += row.sumXY;
    bucket.metrics[key] = existing;
  }

  return closeBuckets(buckets, ctx);
}
