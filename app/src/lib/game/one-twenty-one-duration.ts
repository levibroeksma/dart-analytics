import { clampToBounds } from "./duration-clamp";
import type { OneTwentyOneDurationType } from "./types";

type ClampableDuration = Exclude<OneTwentyOneDurationType, "TARGET">;

export function oneTwentyOneDurationBounds(type: ClampableDuration): {
  min: number;
  max: number;
} {
  return type === "ROUNDS" ? { min: 1, max: 50 } : { min: 3, max: 30 };
}

/**
 * Floors finite numbers, then clamps into the mode's inclusive bounds.
 * Non-finite / non-number inputs clamp to the mode minimum. Never
 * called for `"TARGET"`, which has no `duration_value` to clamp.
 */
export function clampOneTwentyOneDuration(
  type: ClampableDuration,
  value: unknown,
): { value: number; clamped: boolean } {
  return clampToBounds(oneTwentyOneDurationBounds(type), value);
}
