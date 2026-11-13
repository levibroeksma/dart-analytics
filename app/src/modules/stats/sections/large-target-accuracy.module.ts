import { boardNeighbours } from "@lib/game/board/board-geometry.module";
import type {
  AimCountBuckets,
  AimCountMetrics,
  DartZoneKey,
  InferredDart,
  InferredSession,
} from "@modules/types";
import {
  addCounts,
  aimCountDartBuckets,
  aimKey,
  countAimed,
} from "./aim-count.module";

/** The column a large-target dart lands in. */
type Landing =
  "trebles" | "singles" | "neighbourLeft" | "neighbourRight" | "other";

/** Where a dart on the aimed number landed, by zone; any other zone on that number is `other`. */
const SAME_NUMBER_LANDINGS: Partial<Record<DartZoneKey, Landing>> = {
  TREBLE: "trebles",
  INNER_SINGLE: "singles",
  OUTER_SINGLE: "singles",
};

/** Where a dart off the aimed number landed, by its index in `boardNeighbours`; any other number is `other`. */
const NEIGHBOUR_LANDINGS: readonly Landing[] = [
  "neighbourLeft",
  "neighbourRight",
];

/** Which landing column a dart thrown at treble `aimNumber` counts under. */
function landingOf(dart: InferredDart, aimNumber: number): Landing {
  if (dart.hitNumber === aimNumber) {
    return SAME_NUMBER_LANDINGS[dart.hitZone] ?? "other";
  }
  const side = boardNeighbours(aimNumber).indexOf(dart.hitNumber as number);
  return NEIGHBOUR_LANDINGS[side] ?? "other";
}

/** Counts a resolved `LARGE_TARGET` dart under its landing column. */
function countLargeTargetDart(
  metrics: AimCountMetrics,
  dart: InferredDart,
): number {
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
  return aimCountDartBuckets(sessions, ctx, countLargeTargetDart);
}
