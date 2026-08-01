/**
 * `legs_to_win` bounds, matching `FiveOhOneConfig`'s `.min(1).max(20)` and the
 * V1 config screen in `docs/game-rules/rulesets/501.md`.
 */
export const FIVE_OH_ONE_LEGS_MIN = 1;
const FIVE_OH_ONE_LEGS_MAX = 20;

export const FIVE_OH_ONE_LEGS_NOTICE = "Allowed range: 1–20 legs";

/**
 * Floors finite numbers, then clamps into the inclusive legs bounds.
 * Non-finite / non-number inputs clamp to the minimum, so a blank field
 * submits a playable single-leg match rather than failing validation.
 */
export function clampFiveOhOneLegs(value: unknown): {
  value: number;
  clamped: boolean;
} {
  const numeric = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(numeric)) {
    return { value: FIVE_OH_ONE_LEGS_MIN, clamped: true };
  }
  const floored = Math.floor(numeric);
  const clampedValue = Math.min(
    FIVE_OH_ONE_LEGS_MAX,
    Math.max(FIVE_OH_ONE_LEGS_MIN, floored),
  );
  return { value: clampedValue, clamped: clampedValue !== numeric };
}
