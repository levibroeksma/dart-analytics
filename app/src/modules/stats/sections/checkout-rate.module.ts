import { isCheckoutReachable } from "@modules/game/checkout-reachability.module";
import { checkoutDarts } from "@modules/game/double-attempt.module";
import { isFinishingDart } from "@modules/game/highest-checkout.module";
import { visitBuckets } from "./series.module";
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
  return visitBuckets(sessions, ctx, {
    include: (visit) =>
      isCheckoutReachable(visit.startingRemaining, CHANCE_DARTS),
    keyOf: (visit) => String(visit.startingRemaining),
    empty: () => ({ chances: 0, finished: 0 }),
    add: (entry, visit) => {
      entry.chances += 1;
      if (isFinishedVisit(visit)) entry.finished += 1;
    },
  });
}
