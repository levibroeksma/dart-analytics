import type { DartZoneKey } from "@modules/types";

/** A point on the board in regulation millimetres, origin at bull centre, y increasing downward. */
export type BoardPoint = {
  x: number;
  y: number;
};

/** What a coordinate resolves to: the board fact a dart at that point produced. */
export type BoardHit = {
  targetNumber: number | null;
  zoneKey: DartZoneKey;
  score: number;
};

/** A dart as the read layer sees it, carrying declared intent and a landing point. */
export type MissMarginInput = {
  intendedTargetNumber: number | null;
  intendedZoneKey: DartZoneKey | null;
  locationX: number | null;
  locationY: number | null;
};

/** How far from the declared aim point a dart landed, and in which direction. */
export type MissMargin = {
  distanceMm: number;
  bearingDegrees: number;
};
