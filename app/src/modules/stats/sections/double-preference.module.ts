import {
  addCounts,
  AMBIGUOUS_KEY,
  aimCountBuckets,
  aimKey,
} from "./aim-count.module";
import type {
  AimCountMetrics,
  InferredDart,
  InferredSession,
} from "@modules/types";
import type { SeriesBucket } from "@lib/types";

function isSplitAway(dart: InferredDart): boolean {
  return dart.aim !== null && dart.basis !== "FINISH";
}

function foldSession(
  metrics: AimCountMetrics,
  session: InferredSession,
): number {
  let sample = 0;
  for (const visit of session.visits) {
    for (const dart of visit.darts) {
      const finish = dart.finishKey;
      if (finish === null) continue;
      addCounts(metrics, aimKey(finish, "STATE"), {
        left: dart.dartNumber === 1 ? 1 : 0,
        splitAway: isSplitAway(dart) ? 1 : 0,
      });
      if (dart.aim === null) {
        addCounts(metrics, AMBIGUOUS_KEY, { darts: 1 });
      } else if (dart.basis === "FINISH") {
        addCounts(metrics, aimKey(finish, dart.resolution), {
          attempts: 1,
          hits: dart.hit ? 1 : 0,
        });
        sample += 1;
      }
    }
  }
  return sample;
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
): SeriesBucket<AimCountMetrics>[] {
  return aimCountBuckets(sessions, ctx, foldSession);
}
