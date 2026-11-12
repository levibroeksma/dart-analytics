import { bucketFor, closeBuckets } from "./series.module";
import type { AimCountMetrics, InferredSession } from "@modules/types";
import type { SeriesBucket } from "@lib/types";

/** The row an ambiguous dart is counted under -- it has no aim to key by. */
export const AMBIGUOUS_KEY = "AMBIGUOUS";

/** Joins key parts with `|`, the separator every aim-count section keys its rows by. */
export function aimKey(...parts: readonly (string | number)[]): string {
  return parts.join("|");
}

/** Adds each of `counts` onto the row at `key`, creating the row when absent. */
export function addCounts(
  metrics: AimCountMetrics,
  key: string,
  counts: Record<string, number>,
): void {
  const row = metrics[key] ?? {};
  for (const [field, amount] of Object.entries(counts)) {
    row[field] = (row[field] ?? 0) + amount;
  }
  metrics[key] = row;
}

/**
 * Folds inferred sessions into start-keyed aim-count buckets: one metrics
 * accumulator per bucket, `fold` adding a session's counts to it and returning
 * the session's sample-size contribution. A bucket is kept while it holds any
 * row, so an ambiguous-only bucket (sample 0) survives and chunks merge losslessly.
 */
export function aimCountBuckets(
  sessions: readonly InferredSession[],
  ctx: { to: string; now: Date },
  fold: (metrics: AimCountMetrics, session: InferredSession) => number,
): SeriesBucket<AimCountMetrics>[] {
  const buckets = new Map<
    string,
    { end: string; sampleSize: number; metrics: AimCountMetrics }
  >();
  for (const session of sessions) {
    const bucket = bucketFor(buckets, session, () => ({}));
    bucket.sampleSize += fold(bucket.metrics, session);
  }
  for (const [start, bucket] of buckets) {
    if (Object.keys(bucket.metrics).length === 0) buckets.delete(start);
  }
  return closeBuckets(buckets, ctx);
}
