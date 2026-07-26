import { FiveOhOneConfig } from "@lib/game/rulesets/types";
import type { RulesetValidator } from "../interfaces";
import type { BatchValidationResult, ConfigValidationResult } from "../types";

const ALLOWED_CAPTURE_MODE = "RECREATIONAL";
const ALLOWED_INPUT_MODE = "QUICK_SCORE";
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
    if (
      captureModeKey !== ALLOWED_CAPTURE_MODE ||
      inputModeKey !== ALLOWED_INPUT_MODE
    ) {
      return {
        valid: false,
        issues: [
          `501 V1 only supports ${ALLOWED_CAPTURE_MODE} + ${ALLOWED_INPUT_MODE}`,
        ],
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

    for (const stage of batch.stages) {
      for (const turn of stage.turns) {
        if (turn.darts.length > 0) {
          return {
            valid: false,
            code: "VALIDATION_FAILED",
            issues: [
              `turn ${turn.clientKey} must have no dart rows (RECREATIONAL + QUICK_SCORE)`,
            ],
          };
        }
        if (turn.totalScore < 0 || turn.totalScore > maxVisitScore) {
          return {
            valid: false,
            code: "VALIDATION_FAILED",
            issues: [
              `turn ${turn.clientKey} totalScore must be between 0 and ${maxVisitScore}`,
            ],
          };
        }
      }
    }

    return { valid: true };
  },
};
