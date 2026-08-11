/**
 * `starting_score` bounds for the custom setup input, matching
 * `FiveOhOneConfig`'s `.min(2)` floor and the 301/501/701/Custom picker in
 * `docs/game-rules/rulesets/501.md`.
 */
export const FIVE_OH_ONE_STARTING_SCORE_MIN = 2;
const FIVE_OH_ONE_STARTING_SCORE_MAX = 999;
const FIVE_OH_ONE_STARTING_SCORE_DEFAULT = 101;

export const FIVE_OH_ONE_STARTING_SCORE_NOTICE = "Allowed range: 2–999";

/**
 * Floors finite numbers, then clamps into the inclusive starting-score
 * bounds. Non-finite / non-number inputs clamp to the custom field's stated
 * default of 101 — what the input shows before the player types anything —
 * rather than the bare minimum of 2.
 */
export function clampFiveOhOneStartingScore(value: unknown): {
  value: number;
  clamped: boolean;
} {
  const numeric = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(numeric)) {
    return { value: FIVE_OH_ONE_STARTING_SCORE_DEFAULT, clamped: true };
  }
  const floored = Math.floor(numeric);
  const clampedValue = Math.min(
    FIVE_OH_ONE_STARTING_SCORE_MAX,
    Math.max(FIVE_OH_ONE_STARTING_SCORE_MIN, floored),
  );
  return { value: clampedValue, clamped: clampedValue !== numeric };
}
