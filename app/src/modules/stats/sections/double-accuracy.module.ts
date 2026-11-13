import {
  addCounts,
  aimCountDartBuckets,
  aimKey,
  countAimed,
} from "./aim-count.module";
import { missSector, radialClass } from "./miss-direction.module";
import { aimBands, aimPoint } from "../x01-aim-resolution.module";
import type {
  AimCountBuckets,
  AimCountMetrics,
  InferredDart,
  InferredSession,
} from "@modules/types";

/** The miss row key for `dart`: inside or beyond the aim's band, and its compass sector from the aim point. */
function missKey(dart: InferredDart, key: string): string {
  const aim = dart.aim!;
  const point = aimPoint(aim);
  const [rInner, rOuter] = aimBands(aim)[0]!;
  const radial = radialClass(Math.hypot(dart.x, dart.y), rInner, rOuter);
  const sector = missSector(dart.x - point.x, dart.y - point.y);
  return aimKey(key, dart.resolution, "MISS", radial, sector);
}

/** Counts a resolved `FINISH` dart as a hit or a classified miss. */
function countFinishAttempt(
  metrics: AimCountMetrics,
  dart: InferredDart,
): number {
  if (dart.basis !== "FINISH") return 0;
  return countAimed(metrics, dart, (aim) => {
    const key = dart.hit
      ? aimKey(aim.key, dart.resolution, "HIT")
      : missKey(dart, aim.key);
    addCounts(metrics, key, { darts: 1 });
    return 1;
  });
}

/**
 * Folds the 501 darts thrown at a finishing double or the bull into
 * `double-accuracy` buckets: per aim and resolution, the hits, and each miss
 * by whether it fell inside the double (or bull) band, beyond it, and by which
 * compass sector from the aim point. Ambiguous darts are counted under
 * `AMBIGUOUS_KEY`; `sampleSize` is the resolved darts.
 */
export function doubleAccuracyBuckets(
  sessions: readonly InferredSession[],
  ctx: { to: string; now: Date },
): AimCountBuckets {
  return aimCountDartBuckets(sessions, ctx, countFinishAttempt);
}
