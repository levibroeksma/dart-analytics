import { DoublePatternV1Config } from "@lib/exercise/rulesets/types";
import type { ExerciseRulesetValidator } from "@services/interfaces";
import type { ExerciseConfigValidationResult } from "@services/types";

/**
 * Double Pattern v1 asserts only that the pattern list parses — no mode
 * pair, no dart rows to bound (09-training-routines.md §17). The §7
 * sixty-minute cap spans a whole routine, handled elsewhere.
 */
export const doublePatternValidator: ExerciseRulesetValidator = {
  validateConfig({ config }): ExerciseConfigValidationResult {
    const parsed = DoublePatternV1Config.safeParse(config);
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
