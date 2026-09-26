import { isCheckoutReachable } from "@modules/game/checkout-reachability.module";
import { checkoutDarts } from "@modules/game/double-attempt.module";
import { isFinishingDart } from "@modules/game/highest-checkout.module";
import { isClosed } from "./series.module";
import type {
  BucketedSession,
  CheckoutRateMetrics,
  StagedVisit,
} from "@modules/types";
import type { SeriesBucket } from "@lib/types";

/** A checkout chance can never take more than three darts. */
const CHANCE_DARTS = 3;

/** Whether `visit` holds a dart that finished it, walking `checkoutDarts`' shared remaining-before-dart sequence. */
function isFinishedVisit(visit: StagedVisit): boolean {
  return checkoutDarts(visit).some(({ remaining, dart }) =>
    isFinishingDart(remaining, dart),
  );
}

type BucketAccumulator = {
  end: string;
  metrics: CheckoutRateMetrics;
  sampleSize: number;
};

/**
 * Folds session checkout visits into `checkout-rate` buckets (phase-3
 * decision 4): a chance is a visit whose `startingRemaining` is reachable
 * within three darts, and it is finished when some `checkoutDarts` step
 * satisfies `isFinishingDart`. `sampleSize` is the number of chances; a
 * bucket with none is not emitted.
 */
export function checkoutRateBuckets(
  sessions: readonly BucketedSession[],
  ctx: { to: string; now: Date },
): SeriesBucket<CheckoutRateMetrics>[] {
  const buckets = new Map<string, BucketAccumulator>();

  for (const session of sessions) {
    const bucket = buckets.get(session.bucketStart) ?? {
      end: session.bucketEnd,
      metrics: {},
      sampleSize: 0,
    };
    for (const visit of session.visits) {
      if (!isCheckoutReachable(visit.startingRemaining, CHANCE_DARTS)) {
        continue;
      }
      const key = String(visit.startingRemaining);
      const existing = bucket.metrics[key] ?? { chances: 0, finished: 0 };
      existing.chances += 1;
      if (isFinishedVisit(visit)) existing.finished += 1;
      bucket.metrics[key] = existing;
      bucket.sampleSize += 1;
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
