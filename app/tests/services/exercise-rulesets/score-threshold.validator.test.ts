import { describe, expect, it } from "vitest";
import { scoreThresholdValidator } from "@services/exercise-rulesets/score-threshold/score-threshold.validator";

const VALID = { threshold: 65 };

describe("scoreThresholdValidator.validateConfig", () => {
  it("accepts the 65 threshold", () => {
    const result = scoreThresholdValidator.validateConfig({ config: VALID });

    expect(result).toEqual({ ok: true, config: VALID });
  });

  it("rejects another threshold, naming threshold", () => {
    const result = scoreThresholdValidator.validateConfig({
      config: { threshold: 60 },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.join(" ")).toContain("threshold");
  });

  it("rejects a missing threshold", () => {
    expect(scoreThresholdValidator.validateConfig({ config: {} }).ok).toBe(
      false,
    );
  });
});
