import {
  addCounts,
  aimCountDartBuckets,
  aimKey,
  countAimed,
} from "./aim-count.module";
import { aimPoint } from "../x01-aim-resolution.module";
import type {
  AimCountMetrics,
  InferredAim,
  InferredDart,
  InferredSession,
} from "@modules/types";
import type { SeriesBucket } from "@lib/types";

/** The drift row key and offset sums of a resolved dart, its `(dx, dy)` from the aim point. */
function driftCounts(
  dart: InferredDart,
  aim: InferredAim,
): Record<string, number> {
  const point = aimPoint(aim);
  const dx = dart.x - point.x;
  const dy = dart.y - point.y;
  return {
    n: 1,
    sumDx: dx,
    sumDy: dy,
    sumDxDx: dx * dx,
    sumDyDy: dy * dy,
    sumDxDy: dx * dy,
  };
}

/** Adds a resolved dart to its basis, aim, dart number and resolution row. */
function countDriftDart(metrics: AimCountMetrics, dart: InferredDart): number {
  return countAimed(metrics, dart, (aim) => {
    addCounts(
      metrics,
      aimKey(dart.basis, aim.key, dart.dartNumber, dart.resolution),
      driftCounts(dart, aim),
    );
    return 1;
  });
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
  return aimCountDartBuckets(sessions, ctx, countDriftDart);
}
