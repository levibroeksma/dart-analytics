import type { SliderTick } from "./types";

type RangeSliderConfig = { min: number; max: number; fallback?: number };

/** Upper bound on rendered minor+major ticks, so 1–100 stays readable. */
export const MAX_TICKS = 25;

/** Position of `value` along `[min, max]` as 0–1, clamped. */
export function valueToFraction(
  value: number,
  min: number,
  max: number,
): number {
  if (max <= min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/**
 * Coerces a bound model value (number, numeric string, null) to an integer
 * in `[min, max]`; unusable input becomes `fallback` (default `min`).
 */
export function normaliseSliderValue(
  raw: unknown,
  min: number,
  max: number,
  fallback: number = min,
): number {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && raw.trim() !== ""
        ? Number(raw)
        : Number.NaN;
  const base = Number.isFinite(n) ? Math.round(n) : fallback;
  return Math.min(max, Math.max(min, base));
}

/**
 * Tick marks strictly between `min` and `max`. Stride grows so the count
 * stays ≤ `MAX_TICKS`; every 5th stride is major.
 */
export function tickFractions(min: number, max: number): SliderTick[] {
  const span = max - min;
  if (span <= 0) return [];
  const stride = Math.max(1, Math.ceil(span / MAX_TICKS));
  const ticks: SliderTick[] = [];
  for (let step = 1; min + step * stride < max; step++) {
    ticks.push({
      fraction: Math.round(((step * stride) / span) * 1e4) / 1e4,
      major: step % 5 === 0,
    });
  }
  return ticks;
}

/**
 * Alpine factory for `RangeSlider.astro`. `value` is the `x-modelable` slot;
 * once the parent binding lands (`$nextTick`), a non-number or out-of-range
 * model is rewritten to its normalised number so `start()` sees what the
 * slider shows.
 */
export function rangeSliderData(config: RangeSliderConfig) {
  const { min, max } = config;
  const fallback = config.fallback ?? min;
  return {
    value: null as unknown,
    min,
    max,
    ticks: tickFractions(min, max),
    init(this: { value: unknown; $nextTick(cb: () => void): void }) {
      this.$nextTick(() => {
        const next = normaliseSliderValue(this.value, min, max, fallback);
        if (next !== this.value) this.value = next;
      });
    },
    current(): number {
      return normaliseSliderValue(this.value, min, max, fallback);
    },
    fraction(): number {
      return valueToFraction(this.current(), min, max);
    },
    position(): string {
      return `calc(12px + (100% - 24px) * ${this.fraction()})`;
    },
    onInput(raw: string) {
      this.value = normaliseSliderValue(raw, min, max, fallback);
    },
  };
}
