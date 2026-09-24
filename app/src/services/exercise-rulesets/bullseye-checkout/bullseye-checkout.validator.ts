import { BullseyeCheckoutV1Config } from "@lib/training/exercises/rulesets/types";
import type { ExerciseRulesetValidator } from "@services/interfaces";
import type { ExerciseConfigValidationResult } from "@services/types";

/**
 * Bullseye Checkout v1 asserts only that the config parses — a start score
 * of 81, the one value V1 accepts
 * (`docs/game-rules/training/exercises/bullseye-checkout.md`).
 */
export const bullseyeCheckoutValidator: ExerciseRulesetValidator = {
  validateConfig({ config }): ExerciseConfigValidationResult {
    const parsed = BullseyeCheckoutV1Config.safeParse(config);
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
