import { isHit, intendedKey } from "./intent-cells.module";
import { isClosed } from "./series.module";
import type { IntentCellRow, TargetAccuracyMetrics } from "@modules/types";
import type { SeriesBucket } from "@lib/types";

/** Folds `findIntentCells` rows into `target-accuracy` buckets: attempts and hits per intended target. */
export function targetAccuracyBuckets(
  rows: readonly IntentCellRow[],
  ctx: { to: string; now: Date },
): SeriesBucket<TargetAccuracyMetrics>[] {
  const buckets = new Map<
    string,
    { end: string; metrics: TargetAccuracyMetrics; sampleSize: number }
  >();

  for (const row of rows) {
    const bucket = buckets.get(row.bucketStart) ?? {
      end: row.bucketEnd,
      metrics: {},
      sampleSize: 0,
    };
    bucket.sampleSize += row.darts;

    const key = intendedKey(row);
    const existing = bucket.metrics[key] ?? { attempts: 0, hits: 0 };
    existing.attempts += row.darts;
    if (isHit(row)) existing.hits += row.darts;
    bucket.metrics[key] = existing;

    buckets.set(row.bucketStart, bucket);
  }

  return Array.from(buckets.keys())
    .sort()
    .map((start) => {
      const bucket = buckets.get(start)!;
      return {
        start,
        end: bucket.end,
        closed: isClosed(bucket.end, ctx.to, ctx.now),
        sampleSize: bucket.sampleSize,
        metrics: bucket.metrics,
      };
    });
}
