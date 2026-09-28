import { isClosed } from "./series.module";
import type { StepBucketRow, StepVolumeMetrics } from "@modules/types";
import type { SeriesBucket } from "@lib/types";

/**
 * Folds `findStepBuckets` rows into `step-volume` buckets (phase 6b plan
 * decision 6), over any routine step — game or non-game. One row already is
 * one bucket, so this only converts units and shape: `minutes` divides the
 * row's own `durationSum` seconds by 60, exactly, so re-aggregating chunks
 * never drifts from converting an unchunked sum once.
 */
export function stepVolumeBuckets(
  rows: readonly StepBucketRow[],
  ctx: { to: string; now: Date },
): SeriesBucket<StepVolumeMetrics>[] {
  return rows
    .slice()
    .sort((a, b) => a.bucketStart.localeCompare(b.bucketStart))
    .map((row) => ({
      start: row.bucketStart,
      end: row.bucketEnd,
      closed: isClosed(row.bucketEnd, ctx.to, ctx.now),
      sampleSize: row.sessions,
      metrics: {
        sessions: row.sessions,
        minutes: row.durationSum / 60,
        darts: row.darts,
      },
    }));
}
