import { isClosed } from "./series.module";
import type { CompletionMetrics, StatsBucketRow } from "@modules/types";
import type { SeriesBucket } from "@lib/types";

/**
 * Folds `findBucketedSessionAggregates` rows into `completion` buckets.
 * `neverStarted` sessions are `ABANDONED` with `turn_count = 0` (D367
 * decision 5): every other `ABANDONED` group is a mid-game quit, and its
 * `turnSum` feeds `abandonedTurns`. The three counts partition the bucket's
 * population, so `sampleSize` is their sum.
 */
export function completionBuckets(
  rows: readonly StatsBucketRow[],
  ctx: { to: string; now: Date },
): SeriesBucket<CompletionMetrics>[] {
  const buckets = new Map<
    string,
    { end: string; metrics: CompletionMetrics; sampleSize: number }
  >();

  for (const row of rows) {
    const bucket = buckets.get(row.bucketStart) ?? {
      end: row.bucketEnd,
      metrics: {
        completed: 0,
        abandoned: 0,
        neverStarted: 0,
        abandonedTurns: 0,
      },
      sampleSize: 0,
    };
    bucket.sampleSize += row.sessions;
    if (row.statusKey === "COMPLETED") {
      bucket.metrics.completed += row.sessions;
    } else if (row.neverStarted) {
      bucket.metrics.neverStarted += row.sessions;
    } else {
      bucket.metrics.abandoned += row.sessions;
      bucket.metrics.abandonedTurns += row.turnSum;
    }
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
