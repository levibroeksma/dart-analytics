import { checkoutDarts } from "@modules/game/double-attempt.module";
import { isFinishingDart } from "@modules/game/highest-checkout.module";
import { isClosed } from "./series.module";
import type {
  BucketedSession,
  LegStatsMetrics,
  SessionCheckoutVisits,
  StagedVisit,
} from "@modules/types";
import type { SeriesBucket } from "@lib/types";

/** Whether `visit` holds a dart that finished it, walking `checkoutDarts`' shared remaining-before-dart sequence. */
function isFinishedVisit(visit: StagedVisit): boolean {
  return checkoutDarts(visit).some(({ remaining, dart }) =>
    isFinishingDart(remaining, dart),
  );
}

/**
 * The owner's dart count across each finished `LEG` stage in `session`
 * (phase-3 decision 7): a leg counts only when the owner's own visits in it
 * hold a finishing dart, which excludes both an abandoned final leg and a
 * 1v1 leg the opponent won -- the owner's visits then hold no finish either
 * way, since `session.visits` is already scoped to this player.
 */
export function legDarts(session: SessionCheckoutVisits): number[] {
  const legs = new Map<string, StagedVisit[]>();
  for (const visit of session.visits) {
    if (visit.stageTypeKey !== "LEG") continue;
    const leg = legs.get(visit.stageId) ?? [];
    leg.push(visit);
    legs.set(visit.stageId, leg);
  }

  const darts: number[] = [];
  for (const leg of legs.values()) {
    if (!leg.some(isFinishedVisit)) continue;
    darts.push(leg.reduce((sum, visit) => sum + visit.darts.length, 0));
  }
  return darts;
}

type BucketAccumulator = {
  end: string;
  metrics: LegStatsMetrics;
  sampleSize: number;
};

/**
 * Folds session checkout visits into `leg-stats` buckets (phase-3 decision
 * 7): a darts-per-leg histogram. `sampleSize` is the number of finished
 * legs counted; a bucket with none is not emitted.
 */
export function legStatsBuckets(
  sessions: readonly BucketedSession[],
  ctx: { to: string; now: Date },
): SeriesBucket<LegStatsMetrics>[] {
  const buckets = new Map<string, BucketAccumulator>();

  for (const session of sessions) {
    const bucket = buckets.get(session.bucketStart) ?? {
      end: session.bucketEnd,
      metrics: {},
      sampleSize: 0,
    };
    for (const darts of legDarts(session)) {
      const key = String(darts);
      bucket.metrics[key] = (bucket.metrics[key] ?? 0) + 1;
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
