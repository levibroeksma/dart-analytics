import { describe, expect, it } from "vitest";
import { SHANGHAI_RANGES } from "@lib/game/shanghai-ranges.data";

describe("SHANGHAI_RANGES", () => {
  it("offers exactly the five presets, full board first", () => {
    expect(SHANGHAI_RANGES.map((range) => range.value)).toEqual([
      "1-20",
      "1-10",
      "1-7",
      "11-20",
      "13-20",
    ]);
  });

  it("keeps every preset a valid slice of 1..20 whose value names its bounds", () => {
    for (const range of SHANGHAI_RANGES) {
      expect(range.rangeStart).toBeGreaterThanOrEqual(1);
      expect(range.rangeEnd).toBeLessThanOrEqual(20);
      expect(range.rangeStart).toBeLessThanOrEqual(range.rangeEnd);
      expect(range.value).toBe(`${range.rangeStart}-${range.rangeEnd}`);
    }
  });
});
