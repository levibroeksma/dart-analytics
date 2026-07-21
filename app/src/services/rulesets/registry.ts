import type { RulesetValidator } from "./interfaces";
import { scoreTrainingValidator } from "./score-training/score-training.validator";

const REGISTRY: Record<string, RulesetValidator> = {
  SCORE_TRAINING_V1: scoreTrainingValidator,
};

export function getRulesetValidator(
  rulesetVersionKey: string,
): RulesetValidator | undefined {
  return REGISTRY[rulesetVersionKey];
}
