/**
 * Around the Clock V2's timed-run bounds, shared by the V2 schema, the setup
 * form and the routine hook. MINUTES is the only clampable mode.
 */
export function aroundTheClockDurationBounds(): { min: number; max: number } {
  return { min: 3, max: 30 };
}

/**
 * Floors finite numbers, then clamps into the inclusive minute bounds.
 * Non-finite / non-number inputs clamp to the minimum. Mirrors
 * `clampOneTwentyOneDuration`'s MINUTES branch exactly.
 */
export function clampAroundTheClockDuration(value: unknown): {
  value: number;
  clamped: boolean;
} {
  const { min, max } = aroundTheClockDurationBounds();
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

/** The notice shown when a typed minute count was clamped. */
export function aroundTheClockDurationClampNotice(): string {
  return "Allowed range: 3–30 minutes";
}
