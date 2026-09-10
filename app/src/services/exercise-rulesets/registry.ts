import type { ExerciseRulesetValidator } from "./interfaces";
import { warmUpValidator } from "./warm-up/warm-up.validator";

const REGISTRY: Record<string, ExerciseRulesetValidator> = {
  WARM_UP_V1: warmUpValidator,
};

export function getExerciseRulesetValidator(
  exerciseRulesetVersionKey: string,
): ExerciseRulesetValidator | undefined {
  return REGISTRY[exerciseRulesetVersionKey];
}
