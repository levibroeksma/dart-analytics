import {
  addCounts,
  aimCountDartBuckets,
  aimKey,
  countAimed,
} from "./aim-count.module";
import type {
  AimCountBuckets,
  AimCountMetrics,
  InferredDart,
  InferredSession,
} from "@modules/types";

/** Whether `dart` was resolved to an aim other than the finish it had on. */
function isSplitAway(dart: InferredDart): boolean {
  return dart.aim !== null && dart.basis !== "FINISH";
}

/** Counts a dart with a finish on: its `STATE` row always, its attempt row when the finish was the aim. */
function countFinishDart(metrics: AimCountMetrics, dart: InferredDart): number {
  const finish = dart.finishKey;
  if (finish === null) return 0;
  addCounts(metrics, aimKey(finish, "STATE"), {
    left: Number(dart.dartNumber === 1),
    splitAway: Number(isSplitAway(dart)),
  });
  return countAimed(metrics, dart, () => {
    if (dart.basis !== "FINISH") return 0;
    addCounts(metrics, aimKey(finish, dart.resolution), {
      attempts: 1,
      hits: Number(dart.hit),
    });
    return 1;
  });
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
  return aimCountDartBuckets(sessions, ctx, countFinishDart);
}
