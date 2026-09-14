import { describe, expect, it } from "vitest";
import {
  exerciseRulesetWritesDarts,
  getExerciseRulesetValidator,
} from "@services/exercise-rulesets/registry";
import { warmUpValidator } from "@services/exercise-rulesets/warm-up/warm-up.validator";
import { switchingValidator } from "@services/exercise-rulesets/switching/switching.validator";
import { doublePatternValidator } from "@services/exercise-rulesets/double-pattern/double-pattern.validator";

describe("getExerciseRulesetValidator", () => {
  it("resolves WARM_UP_V1", () => {
    expect(getExerciseRulesetValidator("WARM_UP_V1")).toBe(warmUpValidator);
  });

  it("resolves SWITCHING_V1", () => {
    expect(getExerciseRulesetValidator("SWITCHING_V1")).toBe(
      switchingValidator,
    );
  });

  it("resolves DOUBLE_PATTERN_V1", () => {
    expect(getExerciseRulesetValidator("DOUBLE_PATTERN_V1")).toBe(
      doublePatternValidator,
    );
  });

  it("returns undefined for a game ruleset key", () => {
    expect(getExerciseRulesetValidator("501_V1")).toBeUndefined();
  });
});

describe("exerciseRulesetWritesDarts", () => {
  it("is true for the dart exercises, which upload an events batch", () => {
    expect(exerciseRulesetWritesDarts("SWITCHING_V1")).toBe(true);
    expect(exerciseRulesetWritesDarts("DOUBLE_PATTERN_V1")).toBe(true);
  });

  it("is false for Warm-Up, which records no dart", () => {
    expect(exerciseRulesetWritesDarts("WARM_UP_V1")).toBe(false);
  });

  it("is false for a session with no exercise ruleset at all", () => {
    expect(exerciseRulesetWritesDarts(null)).toBe(false);
  });
});
