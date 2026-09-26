import { isClosed } from "./series.module";
import type { HitNumberCellRow, TrebleRateMetrics } from "@modules/types";
import type { SeriesBucket } from "@lib/types";

type BucketAccumulator = {
  end: string;
  metrics: TrebleRateMetrics;
  sampleSize: number;
};

/**
 * Reshapes `findHitNumberCells` rows onto `treble-rate` buckets, keyed by
 * `hitNumber` (`"1"`-`"20"`, `"25"`, or `"MISS"`, already coalesced in SQL).
 * `sampleSize` is the darts summed.
 */
export function trebleRateBuckets(
  rows: readonly HitNumberCellRow[],
  ctx: { to: string; now: Date },
): SeriesBucket<TrebleRateMetrics>[] {
  const buckets = new Map<string, BucketAccumulator>();

  for (const row of rows) {
    const bucket = buckets.get(row.bucketStart) ?? {
      end: row.bucketEnd,
      metrics: {},
      sampleSize: 0,
    };
    const existing = bucket.metrics[row.hitNumber] ?? {
      darts: 0,
      trebles: 0,
    };
    existing.darts += row.darts;
    existing.trebles += row.trebles;
    bucket.metrics[row.hitNumber] = existing;
    bucket.sampleSize += row.darts;
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
