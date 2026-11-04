/**
 * Floors finite numbers, then clamps into the inclusive bounds. Non-finite /
 * non-number inputs clamp to the minimum. `clamped` is true whenever the
 * result differs from the input.
 */
export function clampToBounds(
  bounds: { min: number; max: number },
  value: unknown,
): { value: number; clamped: boolean } {
  const { min, max } = bounds;
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
