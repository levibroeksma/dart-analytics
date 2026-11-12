import {
  BOARD_RADII_MM,
  distanceToBed,
  distanceToDisc,
  sharedEdgePoint,
  zoneCentroid,
} from "@lib/game/board/board-geometry.module";
import type { BoardPoint } from "@lib/types";
import type { DartZoneKey } from "@modules/types";
import type { AimCandidate, InferredAim, ResolvedAim } from "./types";

/** Above this `d1 / d2` a multi-candidate dart has no aim (x01 inferred-aim design §4.5). */
export const AMBIGUITY_RATIO = 0.75;

const OUTER_SINGLE_MID_RADIUS =
  (BOARD_RADII_MM.trebleOuter + BOARD_RADII_MM.doubleInner) / 2;

const SINGLE_ZONES: readonly DartZoneKey[] = [
  "SINGLE",
  "INNER_SINGLE",
  "OUTER_SINGLE",
];

/** Where a player throwing at `aim` points the dart: the bed centroid, the outer single for a single, the bull centre, or the shared edge at outer-single mid radius for a wire. */
export function aimPoint(aim: InferredAim): BoardPoint {
  switch (aim.kind) {
    case "TREBLE":
    case "DOUBLE":
      return zoneCentroid(aim.number, aim.kind) as BoardPoint;
    case "SINGLE":
      return zoneCentroid(aim.number, "OUTER_SINGLE") as BoardPoint;
    case "BULL":
    case "OUTER_BULL":
      return { x: 0, y: 0 };
    case "WIRE":
      return sharedEdgePoint(
        aim.numbers[0],
        aim.numbers[1],
        OUTER_SINGLE_MID_RADIUS,
      );
  }
}

function distanceToSingleBands(point: BoardPoint, number: number): number {
  return Math.min(
    distanceToBed(
      point,
      number,
      BOARD_RADII_MM.outerBull,
      BOARD_RADII_MM.trebleInner,
    ),
    distanceToBed(
      point,
      number,
      BOARD_RADII_MM.trebleOuter,
      BOARD_RADII_MM.doubleInner,
    ),
  );
}

/** Millimetres from `point` to the nearest point of `aim`'s hit region; `0` inside it. */
export function aimDistance(aim: InferredAim, point: BoardPoint): number {
  switch (aim.kind) {
    case "TREBLE":
      return distanceToBed(
        point,
        aim.number,
        BOARD_RADII_MM.trebleInner,
        BOARD_RADII_MM.trebleOuter,
      );
    case "DOUBLE":
      return distanceToBed(
        point,
        aim.number,
        BOARD_RADII_MM.doubleInner,
        BOARD_RADII_MM.doubleOuter,
      );
    case "SINGLE":
      return distanceToSingleBands(point, aim.number);
    case "BULL":
      return distanceToDisc(point, 0, BOARD_RADII_MM.innerBull);
    case "OUTER_BULL":
      return distanceToDisc(
        point,
        BOARD_RADII_MM.innerBull,
        BOARD_RADII_MM.outerBull,
      );
    case "WIRE":
      return Math.min(
        distanceToSingleBands(point, aim.numbers[0]),
        distanceToSingleBands(point, aim.numbers[1]),
      );
  }
}

/** Whether a landed dart is in `aim`'s hit region; a single or wire is hit by single rings only. */
export function isInferredAimHit(
  aim: InferredAim,
  hitNumber: number | null,
  hitZone: DartZoneKey,
): boolean {
  switch (aim.kind) {
    case "TREBLE":
    case "DOUBLE":
      return hitZone === aim.kind && hitNumber === aim.number;
    case "SINGLE":
      return SINGLE_ZONES.includes(hitZone) && hitNumber === aim.number;
    case "BULL":
      return hitZone === "INNER_BULL";
    case "OUTER_BULL":
      return hitZone === "OUTER_BULL";
    case "WIRE":
      return (
        SINGLE_ZONES.includes(hitZone) &&
        hitNumber !== null &&
        aim.numbers.includes(hitNumber)
      );
  }
}

/**
 * Resolves a dart's candidates against its landing point: a sole candidate
 * without reading the point, else the nearest by `distance / weight` unless
 * the nearest two are within `AMBIGUITY_RATIO` (x01 inferred-aim design
 * §4.5).
 */
export function resolveAim(
  candidates: readonly AimCandidate[],
  landing: BoardPoint,
): ResolvedAim {
  const [sole] = candidates;
  if (sole === undefined) {
    throw new Error("resolveAim needs at least one candidate");
  }
  if (candidates.length === 1) {
    return { aim: sole.aim, basis: sole.basis, resolution: "SOLE" };
  }

  const ranked = candidates
    .map((entry) => ({
      entry,
      distance: aimDistance(entry.aim, landing) / entry.weight,
    }))
    .sort((a, b) => a.distance - b.distance);
  const nearest = ranked[0]!;
  const second = ranked[1]!;

  if (
    nearest.distance > 0 &&
    nearest.distance / second.distance > AMBIGUITY_RATIO
  ) {
    return { aim: null, basis: nearest.entry.basis, resolution: "AMBIGUOUS" };
  }
  return {
    aim: nearest.entry.aim,
    basis: nearest.entry.basis,
    resolution: "NEAREST",
  };
}
