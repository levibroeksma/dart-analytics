import {
  BOARD_RADII_MM,
  distanceToBed,
  distanceToDisc,
} from "./board-geometry.module";
import type { IntentZoneKey } from "@lib/types";
import type { BoardPoint } from "./types";

type Band = { rInner: number; rOuter: number };

const WEDGE_BANDS: Partial<Record<IntentZoneKey, Band>> = {
  DOUBLE: {
    rInner: BOARD_RADII_MM.doubleInner,
    rOuter: BOARD_RADII_MM.doubleOuter,
  },
  TREBLE: {
    rInner: BOARD_RADII_MM.trebleInner,
    rOuter: BOARD_RADII_MM.trebleOuter,
  },
  INNER_SINGLE: {
    rInner: BOARD_RADII_MM.outerBull,
    rOuter: BOARD_RADII_MM.trebleInner,
  },
  OUTER_SINGLE: {
    rInner: BOARD_RADII_MM.trebleOuter,
    rOuter: BOARD_RADII_MM.doubleInner,
  },
  NUMBER: { rInner: 0, rOuter: BOARD_RADII_MM.doubleOuter },
};

const DISC_BANDS: Partial<Record<IntentZoneKey, Band>> = {
  INNER_BULL: { rInner: 0, rOuter: BOARD_RADII_MM.innerBull },
  OUTER_BULL: {
    rInner: BOARD_RADII_MM.innerBull,
    rOuter: BOARD_RADII_MM.outerBull,
  },
  BULL: { rInner: 0, rOuter: BOARD_RADII_MM.outerBull },
};

/** Millimetres from `point` to the nearest point of the aimed bed; 0 inside it. A `NUMBER` aim spans every ring of its wedge and a `BULL` aim both bull rings. */
export function distanceToAim(
  point: BoardPoint,
  aim: { number: number; zone: IntentZoneKey },
): number {
  const disc = DISC_BANDS[aim.zone];
  if (disc !== undefined) {
    return distanceToDisc(point, disc.rInner, disc.rOuter);
  }
  if (aim.zone === "SINGLE") {
    return Math.min(
      distanceToAim(point, { number: aim.number, zone: "INNER_SINGLE" }),
      distanceToAim(point, { number: aim.number, zone: "OUTER_SINGLE" }),
    );
  }
  const wedge = WEDGE_BANDS[aim.zone];
  if (wedge === undefined) {
    throw new Error(`no bed for aim zone ${aim.zone}`);
  }
  return distanceToBed(point, aim.number, wedge.rInner, wedge.rOuter);
}
