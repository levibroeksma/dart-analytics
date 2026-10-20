import { ScoreThresholdV1Config } from "@lib/training/exercises/rulesets/types";
import { makeConfigValidator } from "@services/exercise-rulesets/config-validator";

/**
 * Score Threshold v1 asserts only that the config parses — a threshold of
 * 65, the one value V1 accepts
 * (`docs/game-rules/training/exercises/score-threshold.md`).
 */
export const scoreThresholdValidator = makeConfigValidator(
  ScoreThresholdV1Config,
);
