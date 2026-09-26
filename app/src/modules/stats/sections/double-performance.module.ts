import { formatTargetKey } from "@lib/stats/target-key";
import {
  checkoutDarts,
  classifyDart,
} from "@modules/game/double-attempt.module";
import { isClosed } from "./series.module";
import type { BucketedSession, DoublePerformanceMetrics } from "@modules/types";
import type { SeriesBucket, TargetKey } from "@lib/types";

/**
 * The double (or inner bull) a `remaining` requires to finish in one dart,
 * as a `TargetKey` -- `null` when no double can finish it (`classifyDart`'s
 * own `isDirectlyFinishable` gate: any remaining a checkout attempt is
 * classified against is either 50 or an even value 2-40).
 */
export function doubleTargetKey(remaining: number): TargetKey | null {
  if (remaining === 50) return formatTargetKey(25, "INNER_BULL");
  if (remaining % 2 === 0 && remaining >= 2 && remaining <= 40) {
    return formatTargetKey(remaining / 2, "DOUBLE");
  }
  return null;
}

type BucketAccumulator = {
  end: string;
  metrics: DoublePerformanceMetrics;
  sampleSize: number;
};

/**
 * Folds session checkout visits into `double-performance` buckets (phase-3
 * decision 4): every `checkoutDarts` step is classified with `classifyDart`,
 * and a `HIT`/`MISS` counts against the double its remaining required.
 * `NOT_ATTEMPT` steps are skipped. `sampleSize` is the number of counted
 * attempts; a bucket with none is not emitted.
 */
export function doublePerformanceBuckets(
  sessions: readonly BucketedSession[],
  ctx: { to: string; now: Date },
): SeriesBucket<DoublePerformanceMetrics>[] {
  const buckets = new Map<string, BucketAccumulator>();

  for (const session of sessions) {
    const bucket = buckets.get(session.bucketStart) ?? {
      end: session.bucketEnd,
      metrics: {},
      sampleSize: 0,
    };
    for (const visit of session.visits) {
      for (const { remaining, dart } of checkoutDarts(visit)) {
        const outcome = classifyDart(remaining, dart);
        if (outcome === "NOT_ATTEMPT") continue;

        const key = doubleTargetKey(remaining);
        if (key === null) {
          throw new Error(
            `double-performance: classifyDart counted an attempt at remaining ${remaining}, which no double can finish`,
          );
        }

        const existing = bucket.metrics[key] ?? { attempts: 0, hits: 0 };
        existing.attempts += 1;
        if (outcome === "HIT") existing.hits += 1;
        bucket.metrics[key] = existing;
        bucket.sampleSize += 1;
      }
    }
    buckets.set(session.bucketStart, bucket);
  }

  return Array.from(buckets.entries())
    .filter(([, bucket]) => bucket.sampleSize > 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([start, bucket]) => ({
      start,
      end: bucket.end,
      closed: isClosed(bucket.end, ctx.to, ctx.now),
      sampleSize: bucket.sampleSize,
      metrics: bucket.metrics,
    }));
}
