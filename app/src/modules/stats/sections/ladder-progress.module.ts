import { checkoutDarts } from "@modules/game/double-attempt.module";
import { isFinishingDart } from "@modules/game/highest-checkout.module";
import { isClosed } from "./series.module";
import type {
  BucketedSession,
  LadderProgressMetrics,
  SessionCheckoutVisits,
  StagedVisit,
} from "@modules/types";
import type { SeriesBucket } from "@lib/types";

/** Whether `visit` holds a dart that finished it, walking `checkoutDarts`' shared remaining-before-dart sequence. */
function isSuccessfulVisit(visit: StagedVisit): boolean {
  return checkoutDarts(visit).some(({ remaining, dart }) =>
    isFinishingDart(remaining, dart),
  );
}

/**
 * One session's ladder attempts (phase-3 decision 8): for `ONE_TWENTY_ONE`,
 * visits are grouped by their own round's `stageId` in order, one attempt
 * per round, targeted at the round's first `startingRemaining`; for `TUOD`,
 * every visit is its own attempt. Success means some visit in the attempt
 * holds a finishing dart. Any other game type contributes no attempts --
 * `ladder-progress` is never requested for one.
 */
export function ladderAttempts(
  session: SessionCheckoutVisits,
): { target: number; success: boolean }[] {
  if (session.gameTypeKey === "TUOD") {
    return session.visits.map((visit) => ({
      target: visit.startingRemaining,
      success: isSuccessfulVisit(visit),
    }));
  }
  if (session.gameTypeKey !== "ONE_TWENTY_ONE") return [];

  const rounds = new Map<string, StagedVisit[]>();
  for (const visit of session.visits) {
    const round = rounds.get(visit.stageId) ?? [];
    round.push(visit);
    rounds.set(visit.stageId, round);
  }
  return Array.from(rounds.values()).map((round) => ({
    target: round[0]!.startingRemaining,
    success: round.some(isSuccessfulVisit),
  }));
}

type BucketAccumulator = {
  end: string;
  metrics: LadderProgressMetrics;
  sampleSize: number;
};

/**
 * Folds one attempt into `bucket`, given whether the attempt immediately
 * before it (in the same session) failed -- `afterMiss`/`recovered` credit.
 */
function foldAttemptIntoBucket(
  bucket: BucketAccumulator,
  attempt: { target: number; success: boolean },
  previousFailed: boolean,
): void {
  if (previousFailed) {
    bucket.metrics.afterMiss += 1;
    if (attempt.success) bucket.metrics.recovered += 1;
  }
  const key = String(attempt.target);
  const existing = bucket.metrics.targets[key] ?? {
    attempts: 0,
    successes: 0,
  };
  existing.attempts += 1;
  if (attempt.success) existing.successes += 1;
  bucket.metrics.targets[key] = existing;
  bucket.metrics.maxTarget =
    bucket.metrics.maxTarget === null
      ? attempt.target
      : Math.max(bucket.metrics.maxTarget, attempt.target);
  bucket.sampleSize += 1;
}

/**
 * Folds one session's ladder attempts into `bucket`, in order, so
 * `afterMiss`/`recovered` never carry across a session boundary -- the
 * "previous attempt failed" flag resets when a new session starts.
 */
function foldSessionIntoBucket(
  bucket: BucketAccumulator,
  session: SessionCheckoutVisits,
): void {
  let previousFailed = false;
  for (const attempt of ladderAttempts(session)) {
    foldAttemptIntoBucket(bucket, attempt, previousFailed);
    previousFailed = !attempt.success;
  }
}

/**
 * Folds session checkout visits into `ladder-progress` buckets (phase-3
 * decision 8). `sampleSize` is the number of attempts; a bucket with none is
 * not emitted.
 */
export function ladderProgressBuckets(
  sessions: readonly BucketedSession[],
  ctx: { to: string; now: Date },
): SeriesBucket<LadderProgressMetrics>[] {
  const buckets = new Map<string, BucketAccumulator>();

  for (const session of sessions) {
    const bucket = buckets.get(session.bucketStart) ?? {
      end: session.bucketEnd,
      metrics: { targets: {}, maxTarget: null, afterMiss: 0, recovered: 0 },
      sampleSize: 0,
    };
    foldSessionIntoBucket(bucket, session);
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
