import { bucketFor, closeBuckets } from "./series.module";
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
    const bucket = bucketFor(buckets, row, () => ({}));
    const existing = bucket.metrics[row.hitNumber] ?? {
      darts: 0,
      trebles: 0,
    };
    existing.darts += row.darts;
    existing.trebles += row.trebles;
    bucket.metrics[row.hitNumber] = existing;
    bucket.sampleSize += row.darts;
  }

  return closeBuckets(buckets, ctx);
}
