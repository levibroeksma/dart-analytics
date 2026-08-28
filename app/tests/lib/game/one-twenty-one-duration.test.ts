import { describe, it, expect } from "vitest";
import {
  clampOneTwentyOneDuration,
  oneTwentyOneDurationBounds,
  oneTwentyOneDurationClampNotice,
} from "@lib/game/one-twenty-one-duration";

describe("oneTwentyOneDurationBounds", () => {
  it("gives ROUNDS a 1-50 range", () => {
    expect(oneTwentyOneDurationBounds("ROUNDS")).toEqual({ min: 1, max: 50 });
  });

  it("gives MINUTES a 3-30 range", () => {
    expect(oneTwentyOneDurationBounds("MINUTES")).toEqual({ min: 3, max: 30 });
  });
});

describe("clampOneTwentyOneDuration", () => {
  it("floors and passes through an in-range value", () => {
    expect(clampOneTwentyOneDuration("ROUNDS", 10.9)).toEqual({
      value: 10,
      clamped: true,
    });
  });

  it("clamps above the max", () => {
    expect(clampOneTwentyOneDuration("ROUNDS", 100)).toEqual({
      value: 50,
      clamped: true,
    });
  });

  it("clamps below the min", () => {
    expect(clampOneTwentyOneDuration("MINUTES", 0)).toEqual({
      value: 3,
      clamped: true,
    });
  });

  it("clamps a non-finite value to the mode minimum", () => {
    expect(clampOneTwentyOneDuration("MINUTES", null)).toEqual({
      value: 3,
      clamped: true,
    });
  });

  it("reports not-clamped for an exact in-range integer", () => {
    expect(clampOneTwentyOneDuration("ROUNDS", 10)).toEqual({
      value: 10,
      clamped: false,
    });
  });
});

describe("oneTwentyOneDurationClampNotice", () => {
  it("names the ROUNDS range", () => {
    expect(oneTwentyOneDurationClampNotice("ROUNDS")).toBe(
      "Allowed range: 1–50 rounds",
    );
  });

  it("names the MINUTES range", () => {
    expect(oneTwentyOneDurationClampNotice("MINUTES")).toBe(
      "Allowed range: 3–30 minutes",
    );
  });
});
