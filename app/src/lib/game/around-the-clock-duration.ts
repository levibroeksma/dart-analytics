import { clampToBounds } from "./duration-clamp";

/**
 * Around the Clock V2's timed-run bounds, shared by the V2 schema, the setup
 * form and the routine hook. MINUTES is the only clampable mode.
 */
export function aroundTheClockDurationBounds(): { min: number; max: number } {
  return { min: 3, max: 30 };
}

/** Minutes used when a timed run has no typed value. */
export const AROUND_THE_CLOCK_DEFAULT_MINUTES = 10;

/**
 * Floors finite numbers, then clamps into the inclusive minute bounds.
 * Non-finite / non-number inputs clamp to the minimum.
 */
export function clampAroundTheClockDuration(value: unknown): {
  value: number;
  clamped: boolean;
} {
  return clampToBounds(aroundTheClockDurationBounds(), value);
}
