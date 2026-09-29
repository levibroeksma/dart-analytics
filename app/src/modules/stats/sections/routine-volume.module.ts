import { isClosed } from "./series.module";
import type { RoutineRunBucketRow, RoutineVolumeMetrics } from "@modules/types";
import type { SeriesBucket } from "@lib/types";

/**
 * Folds `findRoutineRunBuckets` rows into `routine-volume` buckets (phase 6b
 * plan decision 6). One row already is one bucket — `findRoutineRunBuckets`
 * groups in SQL — so this only reshapes it, never merges rows.
 * `durationSeconds`/`minDurationSeconds`/`maxDurationSeconds` carry the
 * row's own second columns through unconverted (ruling R16): a
 * `seconds / 60` float does not re-add exactly across chunks
 * (`1/60 + 5/60 !== 6/60`), so minutes is a client-side display conversion,
 * never this module's.
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
        durationSeconds: row.durationSum,
        minDurationSeconds: row.durationMin,
        maxDurationSeconds: row.durationMax,
        darts: row.darts,
      },
    }));
}
