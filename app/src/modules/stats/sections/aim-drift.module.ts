import {
  addCounts,
  AMBIGUOUS_KEY,
  aimCountBuckets,
  aimKey,
} from "./aim-count.module";
import { aimPoint } from "../x01-aim-resolution.module";
import type { AimCountMetrics, InferredSession } from "@modules/types";
import type { SeriesBucket } from "@lib/types";

function foldSession(
  metrics: AimCountMetrics,
  session: InferredSession,
): number {
  let sample = 0;
  for (const visit of session.visits) {
    for (const dart of visit.darts) {
      const aim = dart.aim;
      if (aim === null) {
        addCounts(metrics, AMBIGUOUS_KEY, { darts: 1 });
        continue;
      }
      const point = aimPoint(aim);
      const dx = dart.x - point.x;
      const dy = dart.y - point.y;
      addCounts(
        metrics,
        aimKey(dart.basis, aim.key, dart.dartNumber, dart.resolution),
        {
          n: 1,
          sumDx: dx,
          sumDy: dy,
          sumDxDx: dx * dx,
          sumDyDy: dy * dy,
          sumDxDy: dx * dy,
        },
      );
      sample += 1;
    }
  }
  return sample;
}

/**
 * Folds every resolved 501 dart, hits included, into `aim-drift` buckets: per
 * basis, aim, dart number and resolution, the count and the sums of the
 * offset `(dx, dy)` in mm from the aim point, enough to derive bias and
 * spread. Ambiguous darts are counted under `AMBIGUOUS_KEY`; `sampleSize` is
 * the resolved darts.
 */
export function aimDriftBuckets(
  sessions: readonly InferredSession[],
  ctx: { to: string; now: Date },
): SeriesBucket<AimCountMetrics>[] {
  return aimCountBuckets(sessions, ctx, foldSession);
}
