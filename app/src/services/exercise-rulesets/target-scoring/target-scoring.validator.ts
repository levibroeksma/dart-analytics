import { TargetScoringV1Config } from "@lib/training/exercises/rulesets/types";
import type { ExerciseRulesetValidator } from "@services/interfaces";
import type { ExerciseConfigValidationResult } from "@services/types";

/**
 * Target Scoring v1 asserts only that the target list parses — distinct
 * board targets, 1–20 or 25. Scoring is locked in the engine, so there is
 * nothing else to check (`docs/game-rules/training/exercises/target-scoring.md`).
 */
export const targetScoringValidator: ExerciseRulesetValidator = {
  validateConfig({ config }): ExerciseConfigValidationResult {
    const parsed = TargetScoringV1Config.safeParse(config);
    if (!parsed.success) {
      return {
        ok: false,
        issues: parsed.error.issues.map(
          (issue) => `${issue.path.join(".")}: ${issue.message}`,
        ),
      };
    }
    return { ok: true, config: parsed.data as Record<string, unknown> };
  },
};
