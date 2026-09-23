import { describe, expect, it } from "vitest";
import { switchingTargetScoringValidator } from "@services/exercise-rulesets/switching-target-scoring/switching-target-scoring.validator";

const VALID = { targets: [20, 19, 18] };

describe("switchingTargetScoringValidator.validateConfig", () => {
  it("accepts the default sequence", () => {
    const result = switchingTargetScoringValidator.validateConfig({
      config: VALID,
    });

    expect(result).toEqual({ ok: true, config: VALID });
  });

  it("rejects a repeated target, naming targets", () => {
    const result = switchingTargetScoringValidator.validateConfig({
      config: { targets: [20, 20, 19] },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.join(" ")).toContain("targets");
  });

  it("rejects a sequence that is not three targets", () => {
    const result = switchingTargetScoringValidator.validateConfig({
      config: { targets: [20, 19] },
    });

    expect(result.ok).toBe(false);
  });
});
