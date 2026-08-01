import type { ScoreTrainingDurationType } from "./types";

export function scoreTrainingDurationBounds(type: ScoreTrainingDurationType): {
  min: number;
  max: number;
} {
  return type === "ROUNDS" ? { min: 1, max: 100 } : { min: 3, max: 30 };
}

/**
 * Floors finite numbers, then clamps into the mode's inclusive bounds.
 * Non-finite / non-number inputs clamp to the mode minimum.
 */
export function clampScoreTrainingDuration(
  type: ScoreTrainingDurationType,
  value: unknown,
): { value: number; clamped: boolean } {
  const { min, max } = scoreTrainingDurationBounds(type);
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

export function scoreTrainingDurationClampNotice(
  type: ScoreTrainingDurationType,
): string {
  return type === "ROUNDS"
    ? "Allowed range: 1–100 rounds"
    : "Allowed range: 3–30 minutes";
}
