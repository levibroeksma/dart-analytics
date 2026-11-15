import { describe, expect, it } from "vitest";
import { describeDrift } from "@lib/stats/x01/drift-describe";

describe("describeDrift", () => {
  it("names left and low for negative dx and positive dy", () => {
    expect(describeDrift(-4, 2)).toBe("4 mm left, 2 mm low");
  });
  it("names right and high for the opposite signs", () => {
    expect(describeDrift(4, -2)).toBe("4 mm right, 2 mm high");
  });
  it("omits an axis that rounds to zero", () => {
    expect(describeDrift(-4, 0.2)).toBe("4 mm left");
  });
  it("reads on target when both axes round to zero", () => {
    expect(describeDrift(0.2, -0.3)).toBe("on target");
  });
});
