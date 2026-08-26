import { describe, expect, it } from "vitest";
import {
  clampTuodRounds,
  tuodRoundsBounds,
  tuodRoundsClampNotice,
} from "@lib/game/tuod-duration";

describe("tuodRoundsBounds", () => {
  it("returns 1–100", () => {
    expect(tuodRoundsBounds()).toEqual({ min: 1, max: 100 });
  });
});

describe("clampTuodRounds", () => {
  it("leaves an in-range integer unchanged", () => {
    expect(clampTuodRounds(10)).toEqual({ value: 10, clamped: false });
  });
  it("floors a non-integer then clamps", () => {
    expect(clampTuodRounds(10.9)).toEqual({ value: 10, clamped: true });
  });
  it("clamps above max", () => {
    expect(clampTuodRounds(150)).toEqual({ value: 100, clamped: true });
  });
  it("clamps below min, NaN, and non-finite to min", () => {
    expect(clampTuodRounds(0)).toEqual({ value: 1, clamped: true });
    expect(clampTuodRounds(Number.NaN)).toEqual({ value: 1, clamped: true });
    expect(clampTuodRounds(Number.POSITIVE_INFINITY)).toEqual({
      value: 1,
      clamped: true,
    });
  });

  it("clamps what x-model.number actually produces for a blank or unparseable field", () => {
    expect(clampTuodRounds(null)).toEqual({ value: 1, clamped: true });
    expect(clampTuodRounds("abc")).toEqual({ value: 1, clamped: true });
    expect(clampTuodRounds(undefined)).toEqual({ value: 1, clamped: true });
  });
});

describe("tuodRoundsClampNotice", () => {
  it("returns the allowed-range copy", () => {
    expect(tuodRoundsClampNotice()).toBe("Allowed range: 1–100 rounds");
  });
});
