import { ScoreTrainingConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import {
  QUICK_SCORE_OR_VISUAL_BOARD_MODES,
  isQuickScoreOrVisualBoardCapture,
} from "../quick-score.validator";
import { validateScoredBatch } from "../scored-batch.validator";
import { validateModeGatedConfig } from "../mode-gated-config";
import type {
  BatchValidationResult,
  ConfigValidationResult,
  ModedBatchValidationInput,
} from "@services/types";

const DEFAULT_MAX_VISIT_SCORE = 180;

/**
 * Score Training supports two mode pairs. Under RECREATIONAL + QUICK_SCORE
 * every turn is a visit total with no dart rows, capped at the ruleset's own
 * `max_visit_score`. Under ANALYTICS + VISUAL_BOARD every dart carries a
 * landing coordinate, re-derived and cross-checked by
 * `validateVisualBoardTurns`, and a dartless turn is a keypad visit bounded by
 * the same `max_visit_score`. The ROUNDS cap applies to both.
 */
export const scoreTrainingValidator: RulesetValidator = {
  validateConfig({
    config,
    captureModeKey,
    inputModeKey,
  }): ConfigValidationResult {
    return validateModeGatedConfig(
      ScoreTrainingConfig,
      config,
      isQuickScoreOrVisualBoardCapture(captureModeKey, inputModeKey),
      `Score Training V1 only supports ${QUICK_SCORE_OR_VISUAL_BOARD_MODES}`,
    );
  },

  validateBatch(input: ModedBatchValidationInput): BatchValidationResult {
    return validateScoredBatch(input, {
      maxTurnScore:
        (input.config.max_visit_score as number | undefined) ??
        DEFAULT_MAX_VISIT_SCORE,
      limitNoun: "visits",
    });
  },
};
