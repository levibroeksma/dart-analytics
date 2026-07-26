import { FiveOhOneConfig } from "@lib/game/rulesets/types";
import type { RulesetValidator } from "../interfaces";
import {
  QUICK_SCORE_MODES,
  isQuickScoreCapture,
  validateQuickScoreTurns,
} from "../quick-score.validator";
import type { BatchValidationResult, ConfigValidationResult } from "../types";

const DEFAULT_MAX_VISIT_SCORE = 180;

/**
 * 501 is RECREATIONAL + QUICK_SCORE: every turn is a visit total with no
 * dart rows, capped at the ruleset's own `max_visit_score`.
 */
export const fiveOhOneValidator: RulesetValidator = {
  validateConfig({
    config,
    captureModeKey,
    inputModeKey,
  }): ConfigValidationResult {
    if (!isQuickScoreCapture(captureModeKey, inputModeKey)) {
      return {
        valid: false,
        issues: [`501 V1 only supports ${QUICK_SCORE_MODES}`],
      };
    }
    const parsed = FiveOhOneConfig.safeParse(config);
    if (!parsed.success) {
      return { valid: false, issues: parsed.error.issues };
    }
    return { valid: true, config: parsed.data };
  },

  validateBatch({ config, batch }): BatchValidationResult {
    const maxVisitScore =
      (config.max_visit_score as number | undefined) ?? DEFAULT_MAX_VISIT_SCORE;
    return validateQuickScoreTurns(batch, maxVisitScore);
  },
};
