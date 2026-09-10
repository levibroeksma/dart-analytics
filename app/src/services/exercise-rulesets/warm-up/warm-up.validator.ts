import { WarmUpV1Config } from "@lib/exercise/rulesets/types";
import type { ExerciseRulesetValidator } from "@services/interfaces";
import type { ExerciseConfigValidationResult } from "@services/types";

/**
 * Warm-Up v1 asserts only that the phase list parses: the ruleset has no mode
 * pair to cross-check and no dart rows to bound (09-training-routines.md §16).
 * The §7 sixty-minute cap spans a whole routine, so it belongs to
 * `modules/training/routine-duration.module.ts`, not here.
 */
export const warmUpValidator: ExerciseRulesetValidator = {
  validateConfig({ config }): ExerciseConfigValidationResult {
    const parsed = WarmUpV1Config.safeParse(config);
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
