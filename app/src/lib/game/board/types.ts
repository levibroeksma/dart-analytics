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
