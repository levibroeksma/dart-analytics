/**
 * TUOD's 1v1 round count is the only free-typed duration value the ruleset
 * exposes — solo play only ever picks between the two fixed presets, and 1v1
 * is ROUNDS-only (`forceRoundsIfGuested` in `tuod-setup.data.ts`) — so this
 * mirrors `score-training-duration.ts`'s ROUNDS bounds without a MINUTES
 * branch there is nothing to configure.
 */
export function tuodRoundsBounds(): { min: number; max: number } {
  return { min: 1, max: 100 };
}

/**
 * Floors finite numbers, then clamps into the ROUNDS bounds. Non-finite /
 * non-number inputs clamp to the minimum.
 */
export function clampTuodRounds(value: unknown): {
  value: number;
  clamped: boolean;
} {
  const { min, max } = tuodRoundsBounds();
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

export function tuodRoundsClampNotice(): string {
  return "Allowed range: 1–100 rounds";
}
