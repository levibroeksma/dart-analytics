// Confirmed after #297: the three validators' `@lib/exercise/rulesets/types`
// import moved to @lib/training/exercises/rulesets/types; import specifiers
// only, so this file's assertions are unaffected.
import { describe, expect, it } from "vitest";
import {
  exerciseRulesetWritesDarts,
  getExerciseRulesetValidator,
} from "@services/exercise-rulesets/registry";
import { warmUpValidator } from "@services/exercise-rulesets/warm-up/warm-up.validator";
import { switchingValidator } from "@services/exercise-rulesets/switching/switching.validator";
import { doublePatternValidator } from "@services/exercise-rulesets/double-pattern/double-pattern.validator";
import { targetScoringValidator } from "@services/exercise-rulesets/target-scoring/target-scoring.validator";
import { scoreThresholdValidator } from "@services/exercise-rulesets/score-threshold/score-threshold.validator";
import { switchingTargetScoringValidator } from "@services/exercise-rulesets/switching-target-scoring/switching-target-scoring.validator";
import { bullseyeCheckoutValidator } from "@services/exercise-rulesets/bullseye-checkout/bullseye-checkout.validator";
import { bullUpValidator } from "@services/exercise-rulesets/bull-up/bull-up.validator";

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

  it("resolves TARGET_SCORING_V1", () => {
    expect(getExerciseRulesetValidator("TARGET_SCORING_V1")).toBe(
      targetScoringValidator,
    );
  });

  it("resolves SWITCHING_TARGET_SCORING_V1", () => {
    expect(getExerciseRulesetValidator("SWITCHING_TARGET_SCORING_V1")).toBe(
      switchingTargetScoringValidator,
    );
  });

  it("resolves SCORE_THRESHOLD_V1", () => {
    expect(getExerciseRulesetValidator("SCORE_THRESHOLD_V1")).toBe(
      scoreThresholdValidator,
    );
  });

  it("resolves BULLSEYE_CHECKOUT_V1", () => {
    expect(getExerciseRulesetValidator("BULLSEYE_CHECKOUT_V1")).toBe(
      bullseyeCheckoutValidator,
    );
  });

  it("resolves BULL_UP_V1", () => {
    expect(getExerciseRulesetValidator("BULL_UP_V1")).toBe(bullUpValidator);
  });

  it("returns undefined for a game ruleset key", () => {
    expect(getExerciseRulesetValidator("501_V1")).toBeUndefined();
  });
});

describe("exerciseRulesetWritesDarts", () => {
  it("is true for the dart exercises, which upload an events batch", () => {
    expect(exerciseRulesetWritesDarts("SWITCHING_V1")).toBe(true);
    expect(exerciseRulesetWritesDarts("DOUBLE_PATTERN_V1")).toBe(true);
    expect(exerciseRulesetWritesDarts("TARGET_SCORING_V1")).toBe(true);
    expect(exerciseRulesetWritesDarts("SWITCHING_TARGET_SCORING_V1")).toBe(
      true,
    );
    expect(exerciseRulesetWritesDarts("SCORE_THRESHOLD_V1")).toBe(true);
    expect(exerciseRulesetWritesDarts("BULLSEYE_CHECKOUT_V1")).toBe(true);
    expect(exerciseRulesetWritesDarts("BULL_UP_V1")).toBe(true);
  });

  it("is false for Warm-Up, which records no dart", () => {
    expect(exerciseRulesetWritesDarts("WARM_UP_V1")).toBe(false);
  });

  it("is false for a session with no exercise ruleset at all", () => {
    expect(exerciseRulesetWritesDarts(null)).toBe(false);
  });
});
