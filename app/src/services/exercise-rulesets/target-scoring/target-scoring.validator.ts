import { TargetScoringV1Config } from "@lib/training/exercises/rulesets/types";
import { makeConfigValidator } from "@services/exercise-rulesets/config-validator";

/**
 * Target Scoring v1 asserts only that the target list parses — distinct
 * board targets, 1–20 or 25. Scoring is locked in the engine, so there is
 * nothing else to check (`docs/game-rules/training/exercises/target-scoring.md`).
 */
export const targetScoringValidator = makeConfigValidator(
  TargetScoringV1Config,
);
