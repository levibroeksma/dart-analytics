import { SECTOR_ORDER } from "@lib/game/board/board-geometry.module";
import type {
  AimCountMetrics,
  InferredDart,
  InferredSession,
} from "@modules/types";
import type { SeriesBucket } from "@lib/types";
import {
  addCounts,
  AMBIGUOUS_KEY,
  aimCountBuckets,
  aimKey,
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
  let sample = 0;
  for (const visit of session.visits) {
    for (const dart of visit.darts) {
      if (dart.basis !== "LARGE_TARGET") continue;
      const aim = dart.aim;
      if (aim === null) {
        addCounts(metrics, AMBIGUOUS_KEY, { darts: 1 });
        continue;
      }
      if (!("number" in aim)) continue;
      addCounts(metrics, aimKey(aim.key, dart.resolution), {
        darts: 1,
        trebles: 0,
        singles: 0,
        neighbourLeft: 0,
        neighbourRight: 0,
        other: 0,
        [landingOf(dart, aim.number)]: 1,
      });
      sample += 1;
    }
  }
  return sample;
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
): SeriesBucket<AimCountMetrics>[] {
  return aimCountBuckets(sessions, ctx, foldSession);
}
