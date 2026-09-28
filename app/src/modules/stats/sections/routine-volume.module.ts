import { isClosed } from "./series.module";
import type { RoutineRunBucketRow, RoutineVolumeMetrics } from "@modules/types";
import type { SeriesBucket } from "@lib/types";

/**
 * Folds `findRoutineRunBuckets` rows into `routine-volume` buckets (phase 6b
 * plan decision 6). One row already is one bucket — `findRoutineRunBuckets`
 * groups in SQL — so this only converts units and shape, never merges rows.
 * `minutes`/`minMinutes`/`maxMinutes` divide the row's own second columns by
 * 60; the division commutes with the reader's sums, so re-aggregating two
 * chunks' minutes never drifts from converting an unchunked sum once.
 */
export function routineVolumeBuckets(
  rows: readonly RoutineRunBucketRow[],
  ctx: { to: string; now: Date },
): SeriesBucket<RoutineVolumeMetrics>[] {
  return rows
    .slice()
    .sort((a, b) => a.bucketStart.localeCompare(b.bucketStart))
    .map((row) => ({
      start: row.bucketStart,
      end: row.bucketEnd,
      closed: isClosed(row.bucketEnd, ctx.to, ctx.now),
      sampleSize: row.runs,
      metrics: {
        runs: row.runs,
        minutes: row.durationSum / 60,
        minMinutes: row.durationMin / 60,
        maxMinutes: row.durationMax / 60,
        darts: row.darts,
      },
    }));
}
