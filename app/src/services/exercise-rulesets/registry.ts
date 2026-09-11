import type { ExerciseRulesetValidator } from "./interfaces";
import { warmUpValidator } from "./warm-up/warm-up.validator";
import { switchingValidator } from "./switching/switching.validator";

const REGISTRY: Record<string, ExerciseRulesetValidator> = {
  WARM_UP_V1: warmUpValidator,
  SWITCHING_V1: switchingValidator,
};

export function getExerciseRulesetValidator(
  exerciseRulesetVersionKey: string,
): ExerciseRulesetValidator | undefined {
  return REGISTRY[exerciseRulesetVersionKey];
}
