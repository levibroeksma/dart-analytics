import { distanceToAim } from "@lib/game/board/aim-distance.module";
import { NEAR_MISS_MM } from "@lib/stats/constants";
import { isAimHit } from "@lib/stats/target-key";
import { intentCellBuckets } from "./intent-cells.module";
import type { IntentZoneKey, SeriesBucket } from "@lib/types";
import type {
  AimLanding,
  DartZoneKey,
  LooseDartsMetrics,
} from "@modules/types";

const DISTANCE_TOLERANCE_MM = 1e-9;

/**
 * Classifies a landing against its aim: `onTarget` when the dart hit the aim
 * (with or without a landing point), `nearMiss` when a miss lies within
 * `NEAR_MISS_MM` of the aimed bed, `loose` when farther, and `unmeasured`
 * for a miss with no landing point.
 */
export function classifyLanding(
  aim: { number: number; zone: IntentZoneKey },
  hit: { number: number | null; zone: DartZoneKey },
  point: { x: number; y: number } | null,
): "onTarget" | "nearMiss" | "loose" | "unmeasured" {
  if (isAimHit(aim, hit)) return "onTarget";
  if (point === null) return "unmeasured";
  return distanceToAim(point, aim) <= NEAR_MISS_MM + DISTANCE_TOLERANCE_MM
    ? "nearMiss"
    : "loose";
}

function pointOf(row: AimLanding): { x: number; y: number } | null {
  return row.x === null || row.y === null ? null : { x: row.x, y: row.y };
}

/** Folds per-dart landings into `loose-darts` buckets: on/near/loose counts per intended target; an unmeasured miss counts in `sampleSize` only. */
export function looseDartsBuckets(
  rows: readonly AimLanding[],
  ctx: { to: string; now: Date },
): SeriesBucket<LooseDartsMetrics>[] {
  return intentCellBuckets(
    rows,
    ctx,
    () => ({ onTarget: 0, nearMiss: 0, loose: 0 }),
    (entry, row) => {
      const landing = classifyLanding(
        {
          number: row.intendedTargetNumber,
          zone: row.intendedZoneKey as IntentZoneKey,
        },
        { number: row.hitTargetNumber, zone: row.hitZoneKey as DartZoneKey },
        pointOf(row),
      );
      if (landing !== "unmeasured") entry[landing] += row.darts;
    },
  );
}
