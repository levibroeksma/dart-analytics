import { SwitchingChainV1Config } from "@lib/training/exercises/rulesets/types";
import type { ExerciseRulesetValidator } from "@services/interfaces";
import type { ExerciseConfigValidationResult } from "@services/types";

/**
 * Switching Chain v1 asserts only that the sequence parses — exactly three
 * distinct board targets, 1–20 or 25. Scoring is locked in the engine, and
 * the mode is carried by the `SWITCHING_CHAIN_V1` ruleset version key, so
 * the configuration never names it.
 */
export const switchingChainValidator: ExerciseRulesetValidator = {
  validateConfig({ config }): ExerciseConfigValidationResult {
    const parsed = SwitchingChainV1Config.safeParse(config);
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
