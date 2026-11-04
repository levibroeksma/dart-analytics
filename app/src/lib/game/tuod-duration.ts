import { clampToBounds } from "./duration-clamp";
import type { TuodDurationType } from "./types";

/**
 * `duration_value` bounds by mode, identical to
 * `score-training-duration.ts`'s own bounds: ROUNDS 1..100, MINUTES 3..30.
 */
export function tuodDurationBounds(type: TuodDurationType): {
  min: number;
  max: number;
} {
  return type === "ROUNDS" ? { min: 1, max: 100 } : { min: 3, max: 30 };
}

/**
 * Floors finite numbers, then clamps into the mode's inclusive bounds.
 * Non-finite / non-number inputs clamp to the mode minimum.
 */
export function clampTuodDuration(
  type: TuodDurationType,
  value: unknown,
): { value: number; clamped: boolean } {
  return clampToBounds(tuodDurationBounds(type), value);
}
