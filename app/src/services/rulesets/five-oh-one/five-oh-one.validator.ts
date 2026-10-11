import { FiveOhOneConfig, FiveOhOneV2Config } from "@lib/types";
import type { ExistingTurnCounts } from "@repositories/interfaces";
import type { RulesetValidator } from "@services/interfaces";
import {
  QUICK_SCORE_OR_VISUAL_BOARD_MODES,
  isQuickScoreCapture,
  isQuickScoreOrVisualBoardCapture,
  validateQuickScoreTurns,
} from "../quick-score.validator";
import {
  isVisualBoardCapture,
  validateVisualBoardTurns,
} from "../visual-board.validator";
import type { EventsBatchRequestInput } from "@routes/types";
import type {
  BatchValidationResult,
  ConfigValidationResult,
} from "@services/types";

const DEFAULT_MAX_VISIT_SCORE = 180;

function validateBatch({
  config,
  batch,
  captureModeKey,
  inputModeKey,
}: {
  config: Record<string, unknown>;
  batch: EventsBatchRequestInput;
  existingTurnCounts: ExistingTurnCounts;
  captureModeKey: string;
  inputModeKey: string;
}): BatchValidationResult {
  if (isVisualBoardCapture(captureModeKey, inputModeKey)) {
    return validateVisualBoardTurns(
      batch,
      (config.max_visit_score as number | undefined) ?? DEFAULT_MAX_VISIT_SCORE,
    );
  }

  if (!isQuickScoreCapture(captureModeKey, inputModeKey)) {
    return {
      valid: false,
      code: "VALIDATION_FAILED",
      issues: [`unsupported mode pair ${captureModeKey} + ${inputModeKey}`],
    };
  }

  const maxVisitScore =
    (config.max_visit_score as number | undefined) ?? DEFAULT_MAX_VISIT_SCORE;
  return validateQuickScoreTurns(batch, maxVisitScore);
}

/**
 * 501 supports two mode pairs. Under RECREATIONAL + QUICK_SCORE every turn is
 * a visit total with no dart rows, capped at the ruleset's own
 * `max_visit_score`. Under ANALYTICS + VISUAL_BOARD every dart carries a
 * landing coordinate, re-derived and cross-checked by
 * `validateVisualBoardTurns`.
 */
function createFiveOhOneValidator(
  label: string,
  schema: typeof FiveOhOneConfig | typeof FiveOhOneV2Config,
): RulesetValidator {
  return {
    validateConfig({
      config,
      captureModeKey,
      inputModeKey,
    }): ConfigValidationResult {
      if (!isQuickScoreOrVisualBoardCapture(captureModeKey, inputModeKey)) {
        return {
          valid: false,
          issues: [
            `${label} only supports ${QUICK_SCORE_OR_VISUAL_BOARD_MODES}`,
          ],
        };
      }
      const parsed = schema.safeParse(config);
      if (!parsed.success) {
        return { valid: false, issues: parsed.error.issues };
      }
      return { valid: true, config: parsed.data };
    },
    validateBatch,
  };
}

export const fiveOhOneValidator = createFiveOhOneValidator(
  "501 V1",
  FiveOhOneConfig,
);
export const fiveOhOneV2Validator = createFiveOhOneValidator(
  "501 V2",
  FiveOhOneV2Config,
);
