import { ScoreTrainingConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import {
  QUICK_SCORE_MODES,
  exceedsRoundsLimit,
  isQuickScoreCapture,
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

export const scoreTrainingValidator: RulesetValidator = {
  validateConfig({
    config,
    captureModeKey,
    inputModeKey,
  }): ConfigValidationResult {
    if (!isQuickScoreCapture(captureModeKey, inputModeKey)) {
      return {
        valid: false,
        issues: [`Score Training V1 only supports ${QUICK_SCORE_MODES}`],
      };
    }
    const parsed = ScoreTrainingConfig.safeParse(config);
    if (!parsed.success) {
      return { valid: false, issues: parsed.error.issues };
    }
    return { valid: true, config: parsed.data };
  },

  validateBatch({
    config,
    batch,
    existingTurnCount,
    captureModeKey,
    inputModeKey,
  }: {
    config: Record<string, unknown>;
    batch: EventsBatchRequestInput;
    existingTurnCount: number;
    captureModeKey: string;
    inputModeKey: string;
  }): BatchValidationResult {
    if (isVisualBoardCapture(captureModeKey, inputModeKey)) {
      return validateVisualBoardTurns(batch);
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

    const turns = validateQuickScoreTurns(batch, maxVisitScore);
    if (!turns.valid) return turns;

    if (exceedsRoundsLimit(config, batch, existingTurnCount)) {
      return {
        valid: false,
        code: "VALIDATION_FAILED",
        issues: [`session is limited to ${config.duration_value} visits`],
      };
    }

    return { valid: true };
  },
};
