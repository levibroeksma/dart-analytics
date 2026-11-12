import { BOARD_RADII_MM } from "@lib/game/board/board-geometry.module";
import {
  addCounts,
  aimCountBuckets,
  aimKey,
  countAimed,
  sumSessionDarts,
} from "./aim-count.module";
import { missSector, radialClass } from "./miss-direction.module";
import { aimPoint } from "../x01-aim-resolution.module";
import type {
  AimCountBuckets,
  AimCountMetrics,
  InferredDart,
  InferredSession,
} from "@modules/types";

function missKey(dart: InferredDart, key: string): string {
  const aim = dart.aim!;
  const point = aimPoint(aim);
  const [rInner, rOuter] =
    aim.kind === "BULL"
      ? [0, BOARD_RADII_MM.innerBull]
      : [BOARD_RADII_MM.doubleInner, BOARD_RADII_MM.doubleOuter];
  const radial = radialClass(Math.hypot(dart.x, dart.y), rInner, rOuter);
  const sector = missSector(dart.x - point.x, dart.y - point.y);
  return aimKey(key, dart.resolution, "MISS", radial, sector);
}

function foldSession(
  metrics: AimCountMetrics,
  session: InferredSession,
): number {
  return sumSessionDarts(session, (dart) => {
    if (dart.basis !== "FINISH") return 0;
    return countAimed(metrics, dart, (aim) => {
      const key = dart.hit
        ? aimKey(aim.key, dart.resolution, "HIT")
        : missKey(dart, aim.key);
      addCounts(metrics, key, { darts: 1 });
      return 1;
    });
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
  return aimCountBuckets(sessions, ctx, foldSession);
}
