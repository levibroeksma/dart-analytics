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
  const { min, max } = tuodDurationBounds(type);
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

export function tuodDurationClampNotice(type: TuodDurationType): string {
  return type === "ROUNDS"
    ? "Allowed range: 1–100 rounds"
    : "Allowed range: 3–30 minutes";
}
