import { describe, expect, it } from "vitest";
import { getExerciseRulesetValidator } from "@services/exercise-rulesets/registry";
import { warmUpValidator } from "@services/exercise-rulesets/warm-up/warm-up.validator";
import { switchingValidator } from "@services/exercise-rulesets/switching/switching.validator";

describe("getExerciseRulesetValidator", () => {
  it("resolves WARM_UP_V1", () => {
    expect(getExerciseRulesetValidator("WARM_UP_V1")).toBe(warmUpValidator);
  });

  it("resolves SWITCHING_V1", () => {
    expect(getExerciseRulesetValidator("SWITCHING_V1")).toBe(
      switchingValidator,
    );
  });

  it("returns undefined for a game ruleset key", () => {
    expect(getExerciseRulesetValidator("501_V1")).toBeUndefined();
  });
});
