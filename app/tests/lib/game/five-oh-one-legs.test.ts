import { describe, expect, it } from "vitest";
import {
  clampFiveOhOneLegs,
  FIVE_OH_ONE_LEGS_MAX,
  FIVE_OH_ONE_LEGS_MIN,
  FIVE_OH_ONE_LEGS_NOTICE,
} from "@lib/game/five-oh-one-legs";

describe("clampFiveOhOneLegs", () => {
  it("passes an in-range value through unclamped", () => {
    expect(clampFiveOhOneLegs(3)).toEqual({ value: 3, clamped: false });
  });

  it("accepts both bounds", () => {
    expect(clampFiveOhOneLegs(1)).toEqual({ value: 1, clamped: false });
    expect(clampFiveOhOneLegs(20)).toEqual({ value: 20, clamped: false });
  });

  it("clamps above the maximum of 20", () => {
    expect(clampFiveOhOneLegs(50)).toEqual({ value: 20, clamped: true });
  });

  it("clamps below the minimum of 1", () => {
    expect(clampFiveOhOneLegs(0)).toEqual({ value: 1, clamped: true });
    expect(clampFiveOhOneLegs(-4)).toEqual({ value: 1, clamped: true });
  });

  it("floors a fractional value", () => {
    expect(clampFiveOhOneLegs(3.7)).toEqual({ value: 3, clamped: true });
  });

  it("clamps a blank or non-numeric input to the minimum", () => {
    expect(clampFiveOhOneLegs(null)).toEqual({ value: 1, clamped: true });
    expect(clampFiveOhOneLegs("")).toEqual({ value: 1, clamped: true });
    expect(clampFiveOhOneLegs(Number.NaN)).toEqual({ value: 1, clamped: true });
  });

  it("states the allowed range in its notice", () => {
    expect(FIVE_OH_ONE_LEGS_NOTICE).toBe("Allowed range: 1–20 legs");
  });
});

describe("501 legs bounds export", () => {
  it("exports the bounds clampFiveOhOneLegs enforces", () => {
    expect(FIVE_OH_ONE_LEGS_MIN).toBe(1);
    expect(FIVE_OH_ONE_LEGS_MAX).toBe(20);
    expect(clampFiveOhOneLegs(FIVE_OH_ONE_LEGS_MAX + 1).value).toBe(
      FIVE_OH_ONE_LEGS_MAX,
    );
  });
});
