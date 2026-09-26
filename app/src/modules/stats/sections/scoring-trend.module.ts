import { isClosed } from "./series.module";
import type { ScoringTrendMetrics, VisitScoringRow } from "@modules/types";
import type { SeriesBucket } from "@lib/types";

/** Exclusive score-band edges bound into `findVisitScoring` (phase-3 decision 10): `[100,140)`, `[140,180)`, `180`. */
export const SCORE_BANDS = [100, 140, 180] as const;

type BucketAccumulator = {
  end: string;
  metrics: ScoringTrendMetrics;
  sampleSize: number;
};

/**
 * Reshapes `findVisitScoring` rows onto `scoring-trend` buckets: each row is
 * already grouped by bucket in SQL, so this only unwraps its additive sums
 * into the metrics shape, folding same-bucket rows together. `sampleSize` is
 * the darts summed.
 */
export function scoringTrendBuckets(
  rows: readonly VisitScoringRow[],
  ctx: { to: string; now: Date },
): SeriesBucket<ScoringTrendMetrics>[] {
  const buckets = new Map<string, BucketAccumulator>();

  for (const row of rows) {
    const bucket = buckets.get(row.bucketStart) ?? {
      end: row.bucketEnd,
      metrics: {
        points: 0,
        darts: 0,
        firstNinePoints: 0,
        firstNineDarts: 0,
        bands: { ton: 0, tonForty: 0, oneEighty: 0 },
      },
      sampleSize: 0,
    };
    bucket.metrics.points += row.points;
    bucket.metrics.darts += row.darts;
    bucket.metrics.firstNinePoints += row.firstNinePoints;
    bucket.metrics.firstNineDarts += row.firstNineDarts;
    bucket.metrics.bands.ton += row.ton;
    bucket.metrics.bands.tonForty += row.tonForty;
    bucket.metrics.bands.oneEighty += row.oneEighty;
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
