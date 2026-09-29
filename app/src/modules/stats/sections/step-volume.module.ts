import { isClosed } from "./series.module";
import type { StepBucketRow, StepVolumeMetrics } from "@modules/types";
import type { SeriesBucket } from "@lib/types";

/**
 * Folds `findStepBuckets` rows into `step-volume` buckets (phase 6b plan
 * decision 6), over any non-game routine step (a GAME step's own `volume`
 * section covers it instead, controller ruling R1). One row already is one
 * bucket, so this only reshapes it: `durationSeconds` carries the row's own
 * `durationSum` seconds column through unconverted (ruling R16) — a
 * `seconds / 60` float does not re-add exactly across chunks, so minutes is
 * a client-side display conversion, never this module's.
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
        durationSeconds: row.durationSum,
        darts: row.darts,
      },
    }));
}
