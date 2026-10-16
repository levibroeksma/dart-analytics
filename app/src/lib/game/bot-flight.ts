import { BOARD_HALF_EXTENT_MM } from "@lib/game/board-input.data";
import type { DartObservation } from "@modules/types";

const FLY_MS = 240;
const HIT_MS = 70;

/**
 * How a bot dart's pre-throw pause splits into the flight's phases
 * (Animations.dc.html §03): the reticle aims for whatever is left after the
 * fixed fly and hit beats, never below zero.
 */
export function botFlightSchedule(preThrowMs: number): {
  aimMs: number;
  flyMs: number;
  hitMs: number;
} {
  return {
    aimMs: Math.max(0, preThrowMs - FLY_MS - HIT_MS),
    flyMs: FLY_MS,
    hitMs: HIT_MS,
  };
}

/** A dart's landing point as board percentages, or null when unseen. */
export function observationPercent(
  observation: DartObservation,
): { leftPercent: number; topPercent: number } | null {
  const { locationX, locationY } = observation;
  if (locationX === null || locationY === null) return null;
  const span = BOARD_HALF_EXTENT_MM * 2;
  return {
    leftPercent: ((locationX + BOARD_HALF_EXTENT_MM) / span) * 100,
    topPercent: ((locationY + BOARD_HALF_EXTENT_MM) / span) * 100,
  };
}

const ZONE_PREFIX: Partial<Record<DartObservation["hitZoneKey"], string>> = {
  TREBLE: "T",
  DOUBLE: "D",
  SINGLE: "S",
  INNER_SINGLE: "S",
  OUTER_SINGLE: "S",
};

/** The short label a landed dart shows in the visit strip (`T20`, `S25`, `BULL`). */
export function dartLabel(observation: DartObservation): string {
  if (observation.hitZoneKey === "MISS") return "MISS";
  if (observation.hitZoneKey === "INNER_BULL") return "BULL";
  if (observation.hitZoneKey === "OUTER_BULL") return "S25";
  return `${ZONE_PREFIX[observation.hitZoneKey] ?? ""}${observation.hitTargetNumber ?? ""}`;
}
