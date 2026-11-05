import { isHit, intentCellBuckets } from "./intent-cells.module";
import type { IntentCellRow, TargetAccuracyMetrics } from "@modules/types";
import type { SeriesBucket } from "@lib/types";

/** Folds `findIntentCells` rows into `target-accuracy` buckets: attempts and hits per intended target. */
export function targetAccuracyBuckets(
  rows: readonly IntentCellRow[],
  ctx: { to: string; now: Date },
): SeriesBucket<TargetAccuracyMetrics>[] {
  return intentCellBuckets(
    rows,
    ctx,
    () => ({ attempts: 0, hits: 0 }),
    (entry, row) => {
      entry.attempts += row.darts;
      if (isHit(row)) entry.hits += row.darts;
    },
  );
}
