import { describe, it, expect } from "vitest";
import {
  MAX_TICKS,
  normaliseSliderValue,
  rangeSliderData,
  tickFractions,
  valueToFraction,
} from "@lib/ui/range-slider.data";

describe("valueToFraction", () => {
  it("maps min, mid, max to 0, 0.5, 1", () => {
    expect(valueToFraction(5, 5, 30)).toBe(0);
    expect(valueToFraction(17.5, 5, 30)).toBe(0.5);
    expect(valueToFraction(30, 5, 30)).toBe(1);
  });

  it("clamps out-of-range values", () => {
    expect(valueToFraction(0, 5, 30)).toBe(0);
    expect(valueToFraction(99, 5, 30)).toBe(1);
  });

  it("is 0 for a degenerate range", () => {
    expect(valueToFraction(3, 3, 3)).toBe(0);
  });
});

describe("normaliseSliderValue", () => {
  it("keeps an in-range number", () => {
    expect(normaliseSliderValue(12, 1, 50)).toBe(12);
  });

  it("coerces numeric strings and clamps", () => {
    expect(normaliseSliderValue("12", 1, 50)).toBe(12);
    expect(normaliseSliderValue("80", 1, 50)).toBe(50);
  });

  it("uses fallback for null, empty or garbage", () => {
    expect(normaliseSliderValue(null, 3, 30, 10)).toBe(10);
    expect(normaliseSliderValue("", 3, 30, 10)).toBe(10);
    expect(normaliseSliderValue("x", 3, 30, 10)).toBe(10);
  });

  it("defaults fallback to min", () => {
    expect(normaliseSliderValue(undefined, 3, 30)).toBe(3);
  });
});

describe("tickFractions", () => {
  it("matches design 6a for 5–30: one tick per value, major every 5", () => {
    const ticks = tickFractions(5, 30);
    expect(ticks).toHaveLength(24);
    expect(ticks[0]).toEqual({ fraction: 0.04, major: false });
    expect(ticks[4]).toEqual({ fraction: 0.2, major: true });
  });

  it("caps tick count for wide ranges", () => {
    expect(tickFractions(1, 100).length).toBeLessThanOrEqual(MAX_TICKS);
  });

  it("excludes the endpoints", () => {
    const ticks = tickFractions(3, 30);
    expect(ticks.every((t) => t.fraction > 0 && t.fraction < 1)).toBe(true);
  });

  it("is empty for a degenerate range", () => {
    expect(tickFractions(3, 3)).toEqual([]);
  });
});

describe("rangeSliderData", () => {
  function harness(config: Parameters<typeof rangeSliderData>[0]) {
    const ticks: Array<() => void> = [];
    const ctx = Object.assign(rangeSliderData(config), {
      $nextTick(cb: () => void) {
        ticks.push(cb);
      },
    });
    return { ctx, flush: () => ticks.forEach((cb) => cb()) };
  }

  it("writes a normalised number back after the model binds", () => {
    const { ctx, flush } = harness({ min: 3, max: 30, fallback: 10 });
    ctx.init();
    ctx.value = null;
    flush();
    expect(ctx.value).toBe(10);
  });

  it("leaves an already-valid number untouched", () => {
    const { ctx, flush } = harness({ min: 1, max: 50 });
    ctx.init();
    ctx.value = 12;
    flush();
    expect(ctx.value).toBe(12);
  });

  it("onInput stores a number from the native input string", () => {
    const { ctx } = harness({ min: 1, max: 50 });
    ctx.onInput("23");
    expect(ctx.value).toBe(23);
  });

  it("position() is the inset calc for the current fraction", () => {
    const { ctx } = harness({ min: 5, max: 30 });
    ctx.value = 10;
    expect(ctx.position()).toBe("calc(12px + (100% - 24px) * 0.2)");
  });
});
