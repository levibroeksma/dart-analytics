import type { ExerciseConfigValidationResult } from "./types";

/**
 * Server-side validation for one exercise ruleset version. Narrower than the
 * game-side `RulesetValidator`: a non-game exercise writes no turns and no
 * darts, so there is no batch to validate — only the configuration snapshot
 * taken at session start.
 */
export interface ExerciseRulesetValidator {
  validateConfig(input: { config: unknown }): ExerciseConfigValidationResult;
}
