import { SwitchingTargetScoringV1Config } from "@lib/training/exercises/rulesets/types";
import type { ExerciseRulesetValidator } from "@services/interfaces";
import type { ExerciseConfigValidationResult } from "@services/types";

/**
 * Switching Target Scoring v1 asserts only that the sequence parses —
 * exactly three distinct board targets, 1–20 or 25. Scoring is locked in
 * the engine (`docs/game-rules/training/exercises/switching-target-scoring.md`).
 */
export const switchingTargetScoringValidator: ExerciseRulesetValidator = {
  validateConfig({ config }): ExerciseConfigValidationResult {
    const parsed = SwitchingTargetScoringV1Config.safeParse(config);
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
