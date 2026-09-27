import { BULL_TARGET_NUMBER } from "@modules/game/board-progression.module";
import type { DartZoneKey } from "@modules/types";
import type { BoardHit, BoardPoint } from "./types";

/**
 * Regulation board radii in millimetres, measured from the bull centre. These
 * are the authority for what a ring means; `dartboard.svg` is drawn to match
 * them and a parity test proves it still does.
 */
export const BOARD_RADII_MM = {
  innerBull: 6.35,
  outerBull: 15.9,
  trebleInner: 99,
  trebleOuter: 107,
  doubleInner: 162,
  doubleOuter: 170,
  surroundOuter: 220,
} as const;

/** The 20 board numbers in clockwise order, starting at 20 on the upward vertical. */
export const SECTOR_ORDER: readonly number[] = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
];

export const SECTOR_WIDTH_DEGREES = 360 / SECTOR_ORDER.length;

function radiusOf(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

/**
 * Clockwise bearing in degrees from the upward vertical, normalised to
 * `0..360`. The y-axis increases downward, so "up" is negative y.
 */
function bearingDegrees(x: number, y: number): number {
  const degrees = Math.atan2(x, -y) * (180 / Math.PI);
  return (degrees + 360) % 360;
}

function sectorNumber(x: number, y: number): number {
  const offset = bearingDegrees(x, y) + SECTOR_WIDTH_DEGREES / 2;
  const index = Math.floor((offset % 360) / SECTOR_WIDTH_DEGREES);
  return SECTOR_ORDER[index] as number;
}

function scoreFor(targetNumber: number | null, zoneKey: DartZoneKey): number {
  if (zoneKey === "MISS") return 0;
  if (zoneKey === "OUTER_BULL") return 25;
  if (zoneKey === "INNER_BULL") return 50;
  if (targetNumber === null) return 0;
  if (zoneKey === "DOUBLE") return targetNumber * 2;
  if (zoneKey === "TREBLE") return targetNumber * 3;
  return targetNumber;
}

/**
 * Resolves a landing point into the board fact it produced. Every ring
 * boundary belongs to the outer ring, so a point exactly on `trebleInner` is a
 * treble and a point exactly on `doubleOuter` is a miss.
 *
 * A miss carries `targetNumber: null` even when the point sits in a sector's
 * surround — `hit_target_number` means "this number was actually hit", and the
 * sector stays recoverable from the coordinate itself.
 */
export function classify(x: number, y: number): BoardHit {
  const radius = radiusOf(x, y);

  if (radius < BOARD_RADII_MM.innerBull) {
    return {
      targetNumber: BULL_TARGET_NUMBER,
      zoneKey: "INNER_BULL",
      score: 50,
    };
  }
  if (radius < BOARD_RADII_MM.outerBull) {
    return {
      targetNumber: BULL_TARGET_NUMBER,
      zoneKey: "OUTER_BULL",
      score: 25,
    };
  }
  if (radius >= BOARD_RADII_MM.doubleOuter) {
    return { targetNumber: null, zoneKey: "MISS", score: 0 };
  }

  const targetNumber = sectorNumber(x, y);
  const zoneKey: DartZoneKey =
    radius >= BOARD_RADII_MM.doubleInner
      ? "DOUBLE"
      : radius >= BOARD_RADII_MM.trebleOuter
        ? "OUTER_SINGLE"
        : radius >= BOARD_RADII_MM.trebleInner
          ? "TREBLE"
          : "INNER_SINGLE";

  return { targetNumber, zoneKey, score: scoreFor(targetNumber, zoneKey) };
}

function ringMidRadius(zoneKey: DartZoneKey): number | null {
  if (zoneKey === "DOUBLE") {
    return (BOARD_RADII_MM.doubleInner + BOARD_RADII_MM.doubleOuter) / 2;
  }
  if (zoneKey === "TREBLE") {
    return (BOARD_RADII_MM.trebleInner + BOARD_RADII_MM.trebleOuter) / 2;
  }
  if (zoneKey === "INNER_SINGLE") {
    return (BOARD_RADII_MM.outerBull + BOARD_RADII_MM.trebleInner) / 2;
  }
  if (zoneKey === "OUTER_SINGLE") {
    return (BOARD_RADII_MM.trebleOuter + BOARD_RADII_MM.doubleInner) / 2;
  }
  return null;
}

/**
 * The aim point of a declared target, used as the reference a miss margin is
 * measured from. Answers for `DOUBLE`, `TREBLE`, `INNER_SINGLE`,
 * `OUTER_SINGLE`, `INNER_BULL` and `OUTER_BULL`, where the zone has one
 * centre. Returns `null` for the bare `SINGLE` recorded by keypad capture,
 * which spans two disjoint bands (inner and outer) with no single centre to
 * name, and for `MISS`, which has no target.
 */
export function zoneCentroid(
  targetNumber: number | null,
  zoneKey: DartZoneKey,
): BoardPoint | null {
  if (zoneKey === "INNER_BULL" || zoneKey === "OUTER_BULL") {
    return { x: 0, y: 0 };
  }
  if (targetNumber === null) return null;

  const radius = ringMidRadius(zoneKey);
  if (radius === null) return null;

  const index = SECTOR_ORDER.indexOf(targetNumber);
  if (index < 0) return null;

  const radians = index * SECTOR_WIDTH_DEGREES * (Math.PI / 180);
  return { x: radius * Math.sin(radians), y: -radius * Math.cos(radians) };
}

function clampToNumberedBand(radius: number): number {
  return Math.min(
    BOARD_RADII_MM.doubleOuter,
    Math.max(BOARD_RADII_MM.outerBull, radius),
  );
}

function pointAtBearing(bearing: number, radius: number): BoardPoint {
  const radians = bearing * (Math.PI / 180);
  return { x: radius * Math.sin(radians), y: -radius * Math.cos(radians) };
}

/** The signed angular distance from `bearing` to `center`, normalised to `(-180, 180]`. */
function angleDelta(bearing: number, center: number): number {
  return ((((bearing - center) % 360) + 540) % 360) - 180;
}

/**
 * The nearest point of wedge `number`'s own angular span to `point`
 * (phase-4 decision 7): inside the span, `point`'s own bearing with its
 * radius clamped to `[outerBull, doubleOuter]`; outside the span, the
 * projection onto whichever of the wedge's two edge rays is nearer, radius
 * clamped the same way. Used as the miss-direction reference for a `NUMBER`
 * aim, which has no single centre the way a stored zone does.
 */
export function wedgeNearestPoint(
  number: number,
  point: BoardPoint,
): BoardPoint {
  const index = SECTOR_ORDER.indexOf(number);
  if (index < 0) {
    throw new Error(`${number} is not a board number`);
  }

  const center = index * SECTOR_WIDTH_DEGREES;
  const halfWidth = SECTOR_WIDTH_DEGREES / 2;
  const bearing = bearingDegrees(point.x, point.y);
  const delta = angleDelta(bearing, center);
  const radius = clampToNumberedBand(radiusOf(point.x, point.y));

  if (Math.abs(delta) <= halfWidth) {
    return pointAtBearing(bearing, radius);
  }

  const edgeBearing = center + Math.sign(delta) * halfWidth;
  return pointAtBearing(edgeBearing, radius);
}
