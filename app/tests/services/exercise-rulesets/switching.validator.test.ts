import { describe, expect, it } from "vitest";
import { switchingValidator } from "@services/exercise-rulesets/switching/switching.validator";

const VALID = {
  targets: [20, 19, 18],
  scoring: { single: 1, double: 2, treble: 3 },
};

describe("switchingValidator.validateConfig", () => {
  it("accepts a well-formed configuration", () => {
    const result = switchingValidator.validateConfig({ config: VALID });

    expect(result).toEqual({ ok: true, config: VALID });
  });

  it("rejects an empty target list", () => {
    const result = switchingValidator.validateConfig({
      config: { ...VALID, targets: [] },
    });

    expect(result.ok).toBe(false);
  });

  it("names the offending path in its issues", () => {
    const result = switchingValidator.validateConfig({
      config: { ...VALID, scoring: { single: -1, double: 2, treble: 3 } },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.join(" ")).toContain("scoring");
  });
});
