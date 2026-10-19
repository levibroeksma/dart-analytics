import { SwitchingTargetScoringV1Config } from "@lib/training/exercises/rulesets/types";
import { makeConfigValidator } from "@services/exercise-rulesets/config-validator";

/**
 * Switching Target Scoring v1 asserts only that the sequence parses —
 * exactly three distinct board targets, 1–20 or 25. Scoring is locked in
 * the engine (`docs/game-rules/training/exercises/switching-target-scoring.md`).
 */
export const switchingTargetScoringValidator = makeConfigValidator(
  SwitchingTargetScoringV1Config,
);
