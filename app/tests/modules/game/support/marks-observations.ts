import type { DartObservation, DartZoneKey } from "@modules/types";
import { randomObservation } from "./engine-oracle";

const NUMBER_RINGS: readonly DartZoneKey[] = [
  "OUTER_SINGLE",
  "DOUBLE",
  "TREBLE",
];

/**
 * A dart biased onto the marks objectives so a few hundred steps close a
 * game out: 70% a ring on 15–20 or a bull ring, else `randomObservation`.
 */
export function marksObservation(rand: () => number): DartObservation {
  if (rand() >= 0.7) return randomObservation(rand);
  const base = { locationX: null, locationY: null };
  if (rand() < 1 / 7)
    return {
      ...base,
      hitTargetNumber: 25,
      hitZoneKey: rand() < 0.5 ? "OUTER_BULL" : "INNER_BULL",
    };
  return {
    ...base,
    hitTargetNumber: 15 + Math.floor(rand() * 6),
    hitZoneKey: NUMBER_RINGS[Math.floor(rand() * NUMBER_RINGS.length)],
  };
}
