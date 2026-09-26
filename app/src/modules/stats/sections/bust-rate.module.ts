import { resolveCheckoutAttempt } from "@modules/game/checkout-bust.module";
import { checkoutDarts } from "@modules/game/double-attempt.module";
import {
  FINISHING_ZONES,
  isFinishingDart,
} from "@modules/game/highest-checkout.module";
import { isClosed } from "./series.module";
import type {
  BucketedSession,
  BustRateMetrics,
  DartFact,
  StagedVisit,
} from "@modules/types";
import type { SeriesBucket } from "@lib/types";

/** No visit above this can ever bust (three darts cannot overshoot from a lower starting point). */
const BUST_ELIGIBLE_MAX_REMAINING = 180;

/** Whether `dart` landed in a ring a checkout can legally finish on. */
function isFinishingZone(dart: DartFact): boolean {
  return FINISHING_ZONES.has(dart.hitZoneKey);
}

/**
 * Whether `visit` busted before it finished, per the shared double-out rule
 * (`resolveCheckoutAttempt`) walked dart by dart. Stops -- with no bust --
 * the instant a dart finishes, so nothing after a checkout is ever
 * evaluated.
 */
function bustedVisit(visit: StagedVisit): boolean {
  for (const { remaining, dart } of checkoutDarts(visit)) {
    if (isFinishingDart(remaining, dart)) return false;
    const { busted } = resolveCheckoutAttempt(
      remaining,
      dart.score,
      isFinishingZone(dart),
    );
    if (busted) return true;
  }
  return false;
}

type BucketAccumulator = {
  end: string;
  metrics: BustRateMetrics;
  sampleSize: number;
};

/**
 * Folds session checkout visits into `bust-rate` buckets (phase-3 decision
 * 6): every visit whose `startingRemaining` is at most 180 is counted, and a
 * bust is the shared double-out rule only -- a ruleset's own early-bust
 * forfeit is never counted. `sampleSize` is the number of counted visits; a
 * bucket with none is not emitted.
 */
export function bustRateBuckets(
  sessions: readonly BucketedSession[],
  ctx: { to: string; now: Date },
): SeriesBucket<BustRateMetrics>[] {
  const buckets = new Map<string, BucketAccumulator>();

  for (const session of sessions) {
    const bucket = buckets.get(session.bucketStart) ?? {
      end: session.bucketEnd,
      metrics: {},
      sampleSize: 0,
    };
    for (const visit of session.visits) {
      if (visit.startingRemaining > BUST_ELIGIBLE_MAX_REMAINING) continue;
      const key = String(visit.startingRemaining);
      const existing = bucket.metrics[key] ?? { visits: 0, busts: 0 };
      existing.visits += 1;
      if (bustedVisit(visit)) existing.busts += 1;
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
