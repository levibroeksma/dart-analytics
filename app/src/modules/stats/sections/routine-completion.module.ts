import { rowBuckets } from "./series.module";
import type {
  RoutineCompletionMetrics,
  RoutineRunBucketRow,
} from "@modules/types";
import type { SeriesBucket } from "@lib/types";

/**
 * Folds `findRoutineRunBuckets` rows into `routine-completion` buckets
 * (D372 decision 6). One row already is one bucket, so this only
 * reshapes it — `completed`/`abandoned`/`neverStarted` partition the
 * bucket's runs, matching `completionBuckets`' game-grain partition (D367
 * decision 5), so `sampleSize` is `row.runs`.
 */
export function routineCompletionBuckets(
  rows: readonly RoutineRunBucketRow[],
  ctx: { to: string; now: Date },
): SeriesBucket<RoutineCompletionMetrics>[] {
  return rowBuckets(rows, ctx, (row) => ({
    sampleSize: row.runs,
    metrics: {
      completed: row.completed,
      abandoned: row.abandoned,
      neverStarted: row.neverStarted,
      stepsCompletedAtAbandon: row.stepsCompletedAtAbandon,
    },
  }));
}
