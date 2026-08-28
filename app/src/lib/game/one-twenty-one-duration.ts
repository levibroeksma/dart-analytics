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
 * Non-finite / non-number inputs clamp to the mode minimum. Mirrors
 * `clampScoreTrainingDuration` exactly, re-scoped to 121's own bounds — never
 * called for `"TARGET"`, which has no `duration_value` to clamp.
 */
export function clampOneTwentyOneDuration(
  type: ClampableDuration,
  value: unknown,
): { value: number; clamped: boolean } {
  const { min, max } = oneTwentyOneDurationBounds(type);
  const numeric = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(numeric)) {
    return { value: min, clamped: true };
  }
  const floored = Math.floor(numeric);
  const clampedValue = Math.min(max, Math.max(min, floored));
  return {
    value: clampedValue,
    clamped: clampedValue !== numeric,
  };
}

export function oneTwentyOneDurationClampNotice(
  type: ClampableDuration,
): string {
  return type === "ROUNDS"
    ? "Allowed range: 1–50 rounds"
    : "Allowed range: 3–30 minutes";
}
