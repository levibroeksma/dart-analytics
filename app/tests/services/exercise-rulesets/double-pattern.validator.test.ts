import { describe, expect, it } from "vitest";
import { doublePatternValidator } from "@services/exercise-rulesets/double-pattern/double-pattern.validator";

const VALID = {
  patterns: [
    [20, 10, 5],
    [16, 8, 4],
  ],
};

describe("doublePatternValidator.validateConfig", () => {
  it("accepts a well-formed configuration", () => {
    const result = doublePatternValidator.validateConfig({ config: VALID });

    expect(result).toEqual({ ok: true, config: VALID });
  });

  it("rejects an empty pattern list", () => {
    const result = doublePatternValidator.validateConfig({
      config: { patterns: [] },
    });

    expect(result.ok).toBe(false);
  });

  it("rejects a pattern with more than 3 doubles", () => {
    const result = doublePatternValidator.validateConfig({
      config: { patterns: [[20, 10, 5, 2]] },
    });

    expect(result.ok).toBe(false);
  });

  it("names the offending path in its issues", () => {
    const result = doublePatternValidator.validateConfig({
      config: { patterns: [[21]] },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.join(" ")).toContain("patterns");
  });
});
