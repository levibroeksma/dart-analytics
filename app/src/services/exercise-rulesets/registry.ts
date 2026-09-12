import type { ExerciseRulesetValidator } from "./interfaces";
import { warmUpValidator } from "./warm-up/warm-up.validator";
import { switchingValidator } from "./switching/switching.validator";
import { doublePatternValidator } from "./double-pattern/double-pattern.validator";

const REGISTRY: Record<string, ExerciseRulesetValidator> = {
  WARM_UP_V1: warmUpValidator,
  SWITCHING_V1: switchingValidator,
  DOUBLE_PATTERN_V1: doublePatternValidator,
};

export function getExerciseRulesetValidator(
  exerciseRulesetVersionKey: string,
): ExerciseRulesetValidator | undefined {
  return REGISTRY[exerciseRulesetVersionKey];
}
