import { HitCountV1Config } from "@lib/training/exercises/rulesets/types";
import type { ExerciseRulesetValidator } from "@services/interfaces";
import type { ExerciseConfigValidationResult } from "@services/types";

/**
 * Hit Count v1 asserts the target list and darts per target parse —
 * trebles, doubles or the bullseye, a positive multiple of three darts each
 * (`docs/game-rules/training/exercises/hit-count.md`).
 */
export const hitCountValidator: ExerciseRulesetValidator = {
  validateConfig({ config }): ExerciseConfigValidationResult {
    const parsed = HitCountV1Config.safeParse(config);
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
