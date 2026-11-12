import { SECTOR_ORDER } from "@lib/game/board/board-geometry.module";
import type {
  AimCountBuckets,
  AimCountMetrics,
  InferredDart,
  InferredSession,
} from "@modules/types";
import {
  addCounts,
  aimCountBuckets,
  aimKey,
  countAimed,
  sumSessionDarts,
} from "./aim-count.module";

type Landing =
  "trebles" | "singles" | "neighbourLeft" | "neighbourRight" | "other";

function neighbours(number: number): readonly [number, number] {
  const index = SECTOR_ORDER.indexOf(number);
  const size = SECTOR_ORDER.length;
  return [
    SECTOR_ORDER[(index - 1 + size) % size]!,
    SECTOR_ORDER[(index + 1) % size]!,
  ];
}

function landingOf(dart: InferredDart, aimNumber: number): Landing {
  const [left, right] = neighbours(aimNumber);
  if (dart.hitNumber === aimNumber) {
    if (dart.hitZone === "TREBLE") return "trebles";
    if (dart.hitZone === "INNER_SINGLE" || dart.hitZone === "OUTER_SINGLE") {
      return "singles";
    }
    return "other";
  }
  if (dart.hitNumber === left) return "neighbourLeft";
  if (dart.hitNumber === right) return "neighbourRight";
  return "other";
}

function foldSession(
  metrics: AimCountMetrics,
  session: InferredSession,
): number {
  return sumSessionDarts(session, (dart) => {
    if (dart.basis !== "LARGE_TARGET") return 0;
    return countAimed(metrics, dart, (aim) => {
      if (!("number" in aim)) return 0;
      addCounts(metrics, aimKey(aim.key, dart.resolution), {
        darts: 1,
        trebles: 0,
        singles: 0,
        neighbourLeft: 0,
        neighbourRight: 0,
        other: 0,
        [landingOf(dart, aim.number)]: 1,
      });
      return 1;
    });
  });
}

/**
 * Folds the 501 darts thrown at a large target (a treble) into
 * `large-target-accuracy` buckets: per aim and resolution, how many landed on
 * the treble, the number's singles, either neighbouring number, or elsewhere.
 * Ambiguous darts are counted under `AMBIGUOUS_KEY`; `sampleSize` is the
 * resolved darts.
 */
export function largeTargetAccuracyBuckets(
  sessions: readonly InferredSession[],
  ctx: { to: string; now: Date },
): AimCountBuckets {
  return aimCountBuckets(sessions, ctx, foldSession);
}
