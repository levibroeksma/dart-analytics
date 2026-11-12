import { bucketFor, closeBuckets } from "./series.module";
import type {
  AimCountBuckets,
  AimCountMetrics,
  InferredAim,
  InferredDart,
  InferredSession,
} from "@modules/types";

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

/** Sums `fold` over every dart of every visit in `session`. */
export function sumSessionDarts(
  session: InferredSession,
  fold: (dart: InferredDart) => number,
): number {
  let sample = 0;
  for (const visit of session.visits) {
    for (const dart of visit.darts) sample += fold(dart);
  }
  return sample;
}

/**
 * Counts a dart with no aim under `AMBIGUOUS_KEY` and returns `0`; a dart
 * with an aim returns `count(aim)`, its sample-size contribution.
 */
export function countAimed(
  metrics: AimCountMetrics,
  dart: InferredDart,
  count: (aim: InferredAim) => number,
): number {
  if (dart.aim === null) {
    addCounts(metrics, AMBIGUOUS_KEY, { darts: 1 });
    return 0;
  }
  return count(dart.aim);
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
): AimCountBuckets {
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
