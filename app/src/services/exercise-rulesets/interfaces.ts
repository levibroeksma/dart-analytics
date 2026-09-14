import type { ExerciseConfigValidationResult } from "./types";

/**
 * Server-side validation for one exercise ruleset version. Narrower than the
 * game-side `RulesetValidator`: it validates only the configuration snapshot
 * taken at session start. Warm-Up writes no turns and no darts at all; the
 * dart exercises (Switching, Double Pattern) do upload an events batch, which
 * `appendBatch` admits on the session's structural checks alone — no exercise
 * ruleset declares a `validateBatch` today (D277).
 */
export interface ExerciseRulesetValidator {
  validateConfig(input: { config: unknown }): ExerciseConfigValidationResult;
}
