import { describe, expect, it } from "vitest";
import { variationParam } from "@lib/stats/variation";

describe("variationParam", () => {
  it("variationParam returns the score for 501 and undefined for TUOD", () => {
    expect(variationParam("501", 301)).toBe(301);
    expect(variationParam("TUOD", 301)).toBeUndefined();
  });
});
