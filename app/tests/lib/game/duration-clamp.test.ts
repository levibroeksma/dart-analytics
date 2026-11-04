import { describe, expect, it } from "vitest";
import { clampToBounds } from "../../../src/lib/game/duration-clamp";

const bounds = { min: 1, max: 10 };

describe("clampToBounds", () => {
  it.each([[Number.NaN], ["5"], [Number.POSITIVE_INFINITY]])(
    "clamps non-finite or non-number %s to min",
    (input) => {
      expect(clampToBounds(bounds, input)).toEqual({
        value: 1,
        clamped: true,
      });
    },
  );

  it("floors fractional input and flags it", () => {
    expect(clampToBounds(bounds, 5.7)).toEqual({ value: 5, clamped: true });
  });

  it("passes an in-range integer through unflagged", () => {
    expect(clampToBounds(bounds, 5)).toEqual({ value: 5, clamped: false });
  });

  it("clamps below min and above max", () => {
    expect(clampToBounds(bounds, 0)).toEqual({ value: 1, clamped: true });
    expect(clampToBounds(bounds, 11)).toEqual({ value: 10, clamped: true });
  });
});
