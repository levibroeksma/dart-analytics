import { OneTwentyOneConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import {
  QUICK_SCORE_MODES,
  isQuickScoreCapture,
  validateQuickScoreTurns,
} from "../quick-score.validator";
import type {
  BatchValidationResult,
  ConfigValidationResult,
} from "@services/types";

/** The highest total a single 121 visit can legitimately carry — the highest three-dart score on a standard board (T20 T20 T20). */
const MAX_VISIT_SCORE = 180;

/**
 * 121 is RECREATIONAL + QUICK_SCORE: one visit per turn, carrying the visit's
 * scored total or 0 on a bust, with no dart rows — same shape as 501 and
 * TUOD.
 */
export const oneTwentyOneValidator: RulesetValidator = {
  validateConfig({
    config,
    captureModeKey,
    inputModeKey,
  }): ConfigValidationResult {
    if (!isQuickScoreCapture(captureModeKey, inputModeKey)) {
      return {
        valid: false,
        issues: [`121 V1 only supports ${QUICK_SCORE_MODES}`],
      };
    }
    const parsed = OneTwentyOneConfig.safeParse(config);
    if (!parsed.success) {
      return { valid: false, issues: parsed.error.issues };
    }
    return { valid: true, config: parsed.data };
  },

  validateBatch({ batch }): BatchValidationResult {
    return validateQuickScoreTurns(batch, MAX_VISIT_SCORE);
  },
};
