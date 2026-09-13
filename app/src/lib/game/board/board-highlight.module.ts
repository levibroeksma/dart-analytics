import { BULL_TARGET_NUMBER } from "@modules/game/board-progression.module";
import {
  BOARD_RADII_MM,
  SECTOR_ORDER,
  SECTOR_WIDTH_DEGREES,
} from "./board-geometry.module";

/**
 * How far outside a target's actual scoring boundary the Warm-Up highlight
 * outline sits, in millimetres — the "ring-offset" gap
 * (docs/superpowers/specs/2026-09-12-warmup-play-interface-design.md §5.1).
 */
export const HIGHLIGHT_GAP_MM = 4;

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function polarPoint(
  radiusMm: number,
  angleDeg: number,
): { x: number; y: number } {
  const radians = (angleDeg * Math.PI) / 180;
  return {
    x: round3(radiusMm * Math.sin(radians)),
    y: round3(-radiusMm * Math.cos(radians)),
  };
}

/**
 * `SECTOR_ORDER` indices for `targetNumbers`, reordered and unwrapped (values
 * past index 19 continue as 20, 21, …) into one ascending run spanning the
 * gap-free arc that covers them — e.g. 5, 20, 1 (indices 19, 0, 1) becomes
 * [19, 20, 21]. `targetNumbers` is assumed to already form a single
 * contiguous group of adjacent board numbers (how Warm-Up phases are
 * authored); a non-contiguous set produces a span that covers the numbers
 * between its endpoints too, rather than throwing.
 */
function unwrappedSectorIndices(indices: number[]): number[] {
  const length = SECTOR_ORDER.length;
  const sorted = [...new Set(indices)].sort((a, b) => a - b);
  if (sorted.length <= 1) return sorted;

  let largestGap = -1;
  let largestGapAt = 0;
  for (let i = 0; i < sorted.length; i++) {
    const next = sorted[(i + 1) % sorted.length];
    const gap =
      i === sorted.length - 1 ? next + length - sorted[i] : next - sorted[i];
    if (gap > largestGap) {
      largestGap = gap;
      largestGapAt = i;
    }
  }

  const rotateAt = (largestGapAt + 1) % sorted.length;
  const rotated = [...sorted.slice(rotateAt), ...sorted.slice(0, rotateAt)];
  const unwrapped = [rotated[0]];
  for (let i = 1; i < rotated.length; i++) {
    let value = rotated[i];
    while (value <= unwrapped[i - 1]) value += length;
    unwrapped.push(value);
  }
  return unwrapped;
}

/**
 * The full perimeter of the angular group spanned by `targetNumbers` — outer
 * arc, both flanking radial edges, and the inner arc — between
 * `innerRadiusMm` and `outerRadiusMm`. No line is drawn at the boundaries
 * between numbers inside the group; only the group's own outer silhouette
 * (a "pizza slice" from the bull ring to the rim).
 */
export function sectorGroupOutlinePath(
  targetNumbers: readonly number[],
  innerRadiusMm: number,
  outerRadiusMm: number,
): string {
  const indices = targetNumbers.map((number) => {
    const index = SECTOR_ORDER.indexOf(number);
    if (index < 0) throw new Error(`${number} is not a board number`);
    return index;
  });
  const unwrapped = unwrappedSectorIndices(indices);
  const half = SECTOR_WIDTH_DEGREES / 2;
  const startAngle = unwrapped[0] * SECTOR_WIDTH_DEGREES - half;
  const endAngle =
    unwrapped[unwrapped.length - 1] * SECTOR_WIDTH_DEGREES + half;
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  const outerStart = polarPoint(outerRadiusMm, startAngle);
  const outerEnd = polarPoint(outerRadiusMm, endAngle);
  const innerEnd = polarPoint(innerRadiusMm, endAngle);
  const innerStart = polarPoint(innerRadiusMm, startAngle);
  return (
    `M${outerStart.x},${outerStart.y}` +
    `A${outerRadiusMm},${outerRadiusMm},0,${largeArc},1,${outerEnd.x},${outerEnd.y}` +
    `L${innerEnd.x},${innerEnd.y}` +
    `A${innerRadiusMm},${innerRadiusMm},0,${largeArc},0,${innerStart.x},${innerStart.y}Z`
  );
}

/**
 * A full circle outline at `radiusMm`, drawn as two half-circle arcs since a
 * single SVG arc command cannot span 360 degrees.
 */
export function bullOutlinePath(radiusMm: number): string {
  return (
    `M${-radiusMm},0` +
    `A${radiusMm},${radiusMm},0,1,1,${radiusMm},0` +
    `A${radiusMm},${radiusMm},0,1,1,${-radiusMm},0Z`
  );
}

/**
 * The Warm-Up highlight outline for the currently active `targetNumbers` —
 * the bull's own ring for `[25]`, otherwise the merged sector-group
 * perimeter (`sectorGroupOutlinePath`) offset by `HIGHLIGHT_GAP_MM` outside
 * the scoring boundary. Empty for no active targets.
 */
export function dartboardHighlightPath(
  targetNumbers: readonly number[],
): string {
  if (targetNumbers.length === 0) return "";
  if (targetNumbers.includes(BULL_TARGET_NUMBER)) {
    return bullOutlinePath(BOARD_RADII_MM.outerBull + HIGHLIGHT_GAP_MM);
  }
  return sectorGroupOutlinePath(
    targetNumbers,
    BOARD_RADII_MM.outerBull - HIGHLIGHT_GAP_MM,
    BOARD_RADII_MM.doubleOuter + HIGHLIGHT_GAP_MM,
  );
}
