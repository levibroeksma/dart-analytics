import { describe, expect, it } from "vitest";
import { targetScoringValidator } from "@services/exercise-rulesets/target-scoring/target-scoring.validator";

const VALID = { targets: [20, 19, 18, 25] };

describe("targetScoringValidator.validateConfig", () => {
  it("accepts the default list, bull included", () => {
    const result = targetScoringValidator.validateConfig({ config: VALID });

    expect(result).toEqual({ ok: true, config: VALID });
  });

  it("rejects a repeated target, naming targets", () => {
    const result = targetScoringValidator.validateConfig({
      config: { targets: [20, 20] },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.join(" ")).toContain("targets");
  });

  it("rejects a number that is not on the board", () => {
    const result = targetScoringValidator.validateConfig({
      config: { targets: [22] },
    });

    expect(result.ok).toBe(false);
  });
});
