import { describe, expect, it } from "vitest";
import {
  clampFiveOhOneStartingScore,
  FIVE_OH_ONE_STARTING_SCORE_NOTICE,
} from "@lib/game/five-oh-one-starting-score";

describe("clampFiveOhOneStartingScore", () => {
  it("passes an in-range value through unclamped", () => {
    expect(clampFiveOhOneStartingScore(301)).toEqual({
      value: 301,
      clamped: false,
    });
  });

  it("accepts both bounds", () => {
    expect(clampFiveOhOneStartingScore(2)).toEqual({
      value: 2,
      clamped: false,
    });
    expect(clampFiveOhOneStartingScore(999)).toEqual({
      value: 999,
      clamped: false,
    });
  });

  it("clamps above the maximum of 999", () => {
    expect(clampFiveOhOneStartingScore(1500)).toEqual({
      value: 999,
      clamped: true,
    });
  });

  it("clamps below the minimum of 2", () => {
    expect(clampFiveOhOneStartingScore(1)).toEqual({
      value: 2,
      clamped: true,
    });
    expect(clampFiveOhOneStartingScore(-4)).toEqual({
      value: 2,
      clamped: true,
    });
  });

  it("floors a fractional value", () => {
    expect(clampFiveOhOneStartingScore(101.7)).toEqual({
      value: 101,
      clamped: true,
    });
  });

  it("clamps a blank or non-numeric input to the default of 101", () => {
    expect(clampFiveOhOneStartingScore(null)).toEqual({
      value: 101,
      clamped: true,
    });
    expect(clampFiveOhOneStartingScore("")).toEqual({
      value: 101,
      clamped: true,
    });
    expect(clampFiveOhOneStartingScore(Number.NaN)).toEqual({
      value: 101,
      clamped: true,
    });
  });

  it("states the allowed range in its notice", () => {
    expect(FIVE_OH_ONE_STARTING_SCORE_NOTICE).toBe("Allowed range: 2–999");
  });
});
