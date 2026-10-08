type StepperConfig = { min: number; max: number };
type StepperKey = Pick<KeyboardEvent, "key" | "preventDefault">;

/**
 * Clamps `value + delta` into `[min, max]`. Numeric strings are coerced;
 * null, empty or non-numeric input counts as `min`.
 */
export function stepValue(
  value: unknown,
  delta: number,
  min: number,
  max: number,
): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  const base = Number.isFinite(n) ? Math.round(n) : min;
  return Math.min(max, Math.max(min, base + delta));
}

/**
 * Alpine factory for `Stepper.astro`. `value` is the `x-modelable` slot, so
 * it may hold whatever the parent bound (string, null); `current()` is the
 * clamped number the UI shows.
 */
export function stepperData(config: StepperConfig) {
  const { min, max } = config;
  return {
    value: min as unknown,
    min,
    max,
    current(): number {
      return stepValue(this.value, 0, min, max);
    },
    step(delta: number) {
      this.value = stepValue(this.value, delta, min, max);
    },
    onKey(event: StepperKey) {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      this.step(event.key === "ArrowUp" ? 1 : -1);
    },
  };
}
