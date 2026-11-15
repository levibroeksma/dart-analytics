import { describe, expect, it } from "vitest";
import { aimLabel } from "@lib/stats/x01/aim-label";

describe("aimLabel", () => {
  it.each([
    ["TREBLE:20", "T20"],
    ["DOUBLE:16", "D16"],
    ["SINGLE:5", "S5"],
    ["INNER_BULL:25", "Bull"],
    ["OUTER_BULL:25", "25"],
    ["WIRE:20-1", "20/1 wire"],
  ])("%s is %s", (key, label) => {
    expect(aimLabel(key)).toBe(label);
  });
});
