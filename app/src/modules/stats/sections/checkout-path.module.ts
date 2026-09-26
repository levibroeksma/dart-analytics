import { isCheckoutReachable } from "@modules/game/checkout-reachability.module";
import { checkoutDarts } from "@modules/game/double-attempt.module";
import { isFinishingDart } from "@modules/game/highest-checkout.module";
import { isClosed } from "./series.module";
import type {
  BucketedSession,
  CheckoutPathMetrics,
  DartFact,
  StagedVisit,
} from "@modules/types";
import type { SeriesBucket } from "@lib/types";

/** A checkout chance can never take more than three darts. */
const CHANCE_DARTS = 3;

/** One dart's route label, in this section's own vocabulary. */
function dartLabel(dart: DartFact): string {
  if (dart.hitZoneKey === "TREBLE") return `T${dart.hitTargetNumber}`;
  if (dart.hitZoneKey === "DOUBLE") return `D${dart.hitTargetNumber}`;
  if (dart.hitZoneKey === "INNER_BULL") return "BULL";
  if (dart.hitZoneKey === "OUTER_BULL") return "25";
  if (dart.hitZoneKey === "MISS") return "MISS";
  return String(dart.hitTargetNumber);
}

/** The route a visit's darts took, in throw order -- a finished visit's own darts already stop at the finish. */
function routeLabel(darts: readonly DartFact[]): string {
  return darts.map(dartLabel).join(" ");
}

/** Whether `visit` holds a dart that finished it, walking `checkoutDarts`' shared remaining-before-dart sequence. */
function isFinishedVisit(visit: StagedVisit): boolean {
  return checkoutDarts(visit).some(({ remaining, dart }) =>
    isFinishingDart(remaining, dart),
  );
}

type BucketAccumulator = {
  end: string;
  metrics: CheckoutPathMetrics;
  sampleSize: number;
};

/**
 * Folds session checkout visits into `checkout-path` buckets: for every
 * chance visit (the same predicate as `checkout-rate`), the route its darts
 * took is tallied under its `startingRemaining`. `sampleSize` is the number
 * of chance visits; a bucket with none is not emitted.
 */
export function checkoutPathBuckets(
  sessions: readonly BucketedSession[],
  ctx: { to: string; now: Date },
): SeriesBucket<CheckoutPathMetrics>[] {
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
      const remainingKey = String(visit.startingRemaining);
      const routes = bucket.metrics[remainingKey] ?? {};
      const route = routeLabel(visit.darts);
      const existing = routes[route] ?? { visits: 0, finished: 0 };
      existing.visits += 1;
      if (isFinishedVisit(visit)) existing.finished += 1;
      routes[route] = existing;
      bucket.metrics[remainingKey] = routes;
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
