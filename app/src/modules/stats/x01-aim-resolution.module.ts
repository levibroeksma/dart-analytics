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
const AMBIGUITY_RATIO = 0.75;

const OUTER_SINGLE_MID_RADIUS =
  (BOARD_RADII_MM.trebleOuter + BOARD_RADII_MM.doubleInner) / 2;

/** An annulus `[rInner, rOuter]` in board millimetres. */
type Band = readonly [number, number];

/** Both single bands of a number: inner (bull to treble) and outer (treble to double). */
const SINGLE_BANDS: readonly Band[] = [
  [BOARD_RADII_MM.outerBull, BOARD_RADII_MM.trebleInner],
  [BOARD_RADII_MM.trebleOuter, BOARD_RADII_MM.doubleInner],
];

/** The hit region of each aim kind as radial bands: sector beds for a numbered aim, full discs for a bull. */
const AIM_BANDS: Record<InferredAim["kind"], readonly Band[]> = {
  TREBLE: [[BOARD_RADII_MM.trebleInner, BOARD_RADII_MM.trebleOuter]],
  DOUBLE: [[BOARD_RADII_MM.doubleInner, BOARD_RADII_MM.doubleOuter]],
  SINGLE: SINGLE_BANDS,
  WIRE: SINGLE_BANDS,
  BULL: [[0, BOARD_RADII_MM.innerBull]],
  OUTER_BULL: [[BOARD_RADII_MM.innerBull, BOARD_RADII_MM.outerBull]],
};

/** The single rings: keypad's unbanded single and both banded ones. */
const SINGLE_ZONES: readonly DartZoneKey[] = [
  "SINGLE",
  "INNER_SINGLE",
  "OUTER_SINGLE",
];

/** The zones that count as a hit on each aim kind; a single or wire is hit by single rings only. */
const HIT_ZONES: Record<InferredAim["kind"], readonly DartZoneKey[]> = {
  TREBLE: ["TREBLE"],
  DOUBLE: ["DOUBLE"],
  SINGLE: SINGLE_ZONES,
  WIRE: SINGLE_ZONES,
  BULL: ["INNER_BULL"],
  OUTER_BULL: ["OUTER_BULL"],
};

/** The zone whose centroid a numbered aim points at: the bed itself, the outer single for a single. */
const POINT_ZONES: Record<"TREBLE" | "DOUBLE" | "SINGLE", DartZoneKey> = {
  TREBLE: "TREBLE",
  DOUBLE: "DOUBLE",
  SINGLE: "OUTER_SINGLE",
};

/** The board numbers an aim covers: one for a numbered aim, two for a wire, `null` for a bull, which covers no sector. */
function aimNumbers(aim: InferredAim): readonly number[] | null {
  if (aim.kind === "WIRE") return aim.numbers;
  return "number" in aim ? [aim.number] : null;
}

/** The radial bands of `aim`'s hit region, innermost first. */
export function aimBands(aim: InferredAim): readonly Band[] {
  return AIM_BANDS[aim.kind];
}

/** Where a player throwing at `aim` points the dart: the bed centroid, the outer single for a single, the bull centre, or the shared edge at outer-single mid radius for a wire. */
export function aimPoint(aim: InferredAim): BoardPoint {
  if (aim.kind === "WIRE") {
    return sharedEdgePoint(
      aim.numbers[0],
      aim.numbers[1],
      OUTER_SINGLE_MID_RADIUS,
    );
  }
  if (!("number" in aim)) return { x: 0, y: 0 };
  return zoneCentroid(aim.number, POINT_ZONES[aim.kind]) as BoardPoint;
}

/** Millimetres from `point` to one band of `aim`: the sector bed of each number it covers, or the full disc of a bull. */
function bandDistance(
  point: BoardPoint,
  numbers: readonly number[] | null,
  [rInner, rOuter]: Band,
): number {
  if (numbers === null) return distanceToDisc(point, rInner, rOuter);
  return Math.min(
    ...numbers.map((number) => distanceToBed(point, number, rInner, rOuter)),
  );
}

/** Millimetres from `point` to the nearest point of `aim`'s hit region; `0` inside it. */
function aimDistance(aim: InferredAim, point: BoardPoint): number {
  const numbers = aimNumbers(aim);
  return Math.min(
    ...aimBands(aim).map((band) => bandDistance(point, numbers, band)),
  );
}

/** Whether a landed dart is in `aim`'s hit region; a single or wire is hit by single rings only, a bull by its ring whatever the number. */
export function isInferredAimHit(
  aim: InferredAim,
  hitNumber: number | null,
  hitZone: DartZoneKey,
): boolean {
  const numbers = aimNumbers(aim);
  return (
    HIT_ZONES[aim.kind].includes(hitZone) &&
    (numbers === null || numbers.includes(hitNumber as number))
  );
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
