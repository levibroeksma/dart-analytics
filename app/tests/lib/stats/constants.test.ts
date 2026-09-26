import { describe, it, expect } from "vitest";
import { MIN_TARGET_SAMPLE } from "@lib/stats/constants";

describe("MIN_TARGET_SAMPLE", () => {
  it("is a positive integer", () => {
    expect(Number.isInteger(MIN_TARGET_SAMPLE)).toBe(true);
    expect(MIN_TARGET_SAMPLE).toBeGreaterThan(0);
  });
});
