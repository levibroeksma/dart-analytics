import { describe, it, expect } from "vitest";
import { getRulesetValidator } from "@services/rulesets/registry";

describe("getRulesetValidator", () => {
  it("returns the Score Training validator for SCORE_TRAINING_V1", () => {
    expect(getRulesetValidator("SCORE_TRAINING_V1")).toBeDefined();
  });

  it("returns undefined for an unknown ruleset key", () => {
    expect(getRulesetValidator("NOT_A_RULESET")).toBeUndefined();
  });
});
