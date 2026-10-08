import { describe, it, expect } from "vitest";
import {
  AROUND_THE_CLOCK_DEFAULT_MINUTES,
  aroundTheClockDurationBounds,
  aroundTheClockDurationClampNotice,
  clampAroundTheClockDuration,
} from "@lib/game/around-the-clock-duration";

describe("aroundTheClockDurationBounds", () => {
  it("gives a 3-30 minute range", () => {
    expect(aroundTheClockDurationBounds()).toEqual({ min: 3, max: 30 });
  });
});

describe("clampAroundTheClockDuration", () => {
  it("clamps below the min", () => {
    expect(clampAroundTheClockDuration(2)).toEqual({ value: 3, clamped: true });
  });

  it("clamps above the max", () => {
    expect(clampAroundTheClockDuration(31)).toEqual({
      value: 30,
      clamped: true,
    });
  });

  it("floors a fraction", () => {
    expect(clampAroundTheClockDuration(12.7)).toEqual({
      value: 12,
      clamped: true,
    });
  });

  it("maps a non-number to the min", () => {
    expect(clampAroundTheClockDuration("x")).toEqual({
      value: 3,
      clamped: true,
    });
  });

  it("passes an in-range integer through", () => {
    expect(clampAroundTheClockDuration(10)).toEqual({
      value: 10,
      clamped: false,
    });
  });
});

describe("aroundTheClockDurationClampNotice", () => {
  it("names the minute range", () => {
    expect(aroundTheClockDurationClampNotice()).toBe(
      "Allowed range: 3–30 minutes",
    );
  });
});

describe("ATC default minutes export", () => {
  it("is 10 and inside the duration bounds", () => {
    const { min, max } = aroundTheClockDurationBounds();
    expect(AROUND_THE_CLOCK_DEFAULT_MINUTES).toBe(10);
    expect(AROUND_THE_CLOCK_DEFAULT_MINUTES).toBeGreaterThanOrEqual(min);
    expect(AROUND_THE_CLOCK_DEFAULT_MINUTES).toBeLessThanOrEqual(max);
  });
});
