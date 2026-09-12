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
 * One continuous outline around `targetNumber`'s full angular sector, from
 * `innerRadiusMm` to `outerRadiusMm` — both radial edges plus the inner and
 * outer arcs, with no line at the internal single/treble/double boundaries.
 * Mirrors the quadrilateral-with-two-arcs shape `DartBoard.astro`'s own
 * per-ring paths already draw.
 */
export function wedgeOutlinePath(
  targetNumber: number,
  innerRadiusMm: number,
  outerRadiusMm: number,
): string {
  const index = SECTOR_ORDER.indexOf(targetNumber);
  if (index < 0) {
    throw new Error(`${targetNumber} is not a board number`);
  }
  const center = index * SECTOR_WIDTH_DEGREES;
  const half = SECTOR_WIDTH_DEGREES / 2;
  const outerStart = polarPoint(outerRadiusMm, center - half);
  const outerEnd = polarPoint(outerRadiusMm, center + half);
  const innerEnd = polarPoint(innerRadiusMm, center + half);
  const innerStart = polarPoint(innerRadiusMm, center - half);
  return (
    `M${outerStart.x},${outerStart.y}` +
    `A${outerRadiusMm},${outerRadiusMm},0,0,1,${outerEnd.x},${outerEnd.y}` +
    `L${innerEnd.x},${innerEnd.y}` +
    `A${innerRadiusMm},${innerRadiusMm},0,0,0,${innerStart.x},${innerStart.y}Z`
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
 * One highlight outline per board number plus one for the bull, in
 * `SECTOR_ORDER` order with the bull last — computed once from
 * `BOARD_RADII_MM` rather than hand-authored. `DartBoard.astro`'s highlight
 * overlay renders exactly these.
 */
export const DARTBOARD_HIGHLIGHT_PATHS: ReadonlyArray<{
  readonly number: number;
  readonly d: string;
}> = [
  ...SECTOR_ORDER.map((number) => ({
    number,
    d: wedgeOutlinePath(
      number,
      BOARD_RADII_MM.outerBull - HIGHLIGHT_GAP_MM,
      BOARD_RADII_MM.doubleOuter + HIGHLIGHT_GAP_MM,
    ),
  })),
  {
    number: BULL_TARGET_NUMBER,
    d: bullOutlinePath(BOARD_RADII_MM.outerBull + HIGHLIGHT_GAP_MM),
  },
];
