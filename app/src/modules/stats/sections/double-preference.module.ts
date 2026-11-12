import {
  addCounts,
  aimCountBuckets,
  aimKey,
  countAimed,
  sumSessionDarts,
} from "./aim-count.module";
import type {
  AimCountBuckets,
  AimCountMetrics,
  InferredDart,
  InferredSession,
} from "@modules/types";

function isSplitAway(dart: InferredDart): boolean {
  return dart.aim !== null && dart.basis !== "FINISH";
}

function countFinishDart(metrics: AimCountMetrics, dart: InferredDart): number {
  const finish = dart.finishKey;
  if (finish === null) return 0;
  addCounts(metrics, aimKey(finish, "STATE"), {
    left: dart.dartNumber === 1 ? 1 : 0,
    splitAway: isSplitAway(dart) ? 1 : 0,
  });
  return countAimed(metrics, dart, () => {
    if (dart.basis !== "FINISH") return 0;
    addCounts(metrics, aimKey(finish, dart.resolution), {
      attempts: 1,
      hits: dart.hit ? 1 : 0,
    });
    return 1;
  });
}

function foldSession(
  metrics: AimCountMetrics,
  session: InferredSession,
): number {
  return sumSessionDarts(session, (dart) => countFinishDart(metrics, dart));
}

/**
 * Folds the 501 darts thrown with a finishing double or the bull available
 * into `double-preference` buckets: per finish key, how often it was left (the
 * visit's first dart) and how often the thrower split away from it, beside the
 * attempts and hits when it was the aim. Ambiguous darts are counted under
 * `AMBIGUOUS_KEY`; `sampleSize` is the attempts.
 */
export function doublePreferenceBuckets(
  sessions: readonly InferredSession[],
  ctx: { to: string; now: Date },
): AimCountBuckets {
  return aimCountBuckets(sessions, ctx, foldSession);
}
