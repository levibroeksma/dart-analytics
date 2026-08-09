import { ScoreTrainingConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import {
  QUICK_SCORE_OR_VISUAL_BOARD_MODES,
  exceedsRoundsLimit,
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

/**
 * The ROUNDS cap, as one expression both mode pairs reach. A visit is a visit
 * whichever way it was entered, so a session limited to N visits is limited to
 * N visits on the board too — the cap belongs to the config, not to the
 * capture mode.
 */
function roundsLimitRejection(
  config: Record<string, unknown>,
  batch: EventsBatchRequestInput,
  existingTurnCount: number,
): BatchValidationResult {
  if (exceedsRoundsLimit(config, batch, existingTurnCount)) {
    return {
      valid: false,
      code: "VALIDATION_FAILED",
      issues: [`session is limited to ${config.duration_value} visits`],
    };
  }
  return { valid: true };
}

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
    if (!isQuickScoreOrVisualBoardCapture(captureModeKey, inputModeKey)) {
      return {
        valid: false,
        issues: [
          `Score Training V1 only supports ${QUICK_SCORE_OR_VISUAL_BOARD_MODES}`,
        ],
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
      const turns = validateVisualBoardTurns(
        batch,
        (config.max_visit_score as number | undefined) ??
          DEFAULT_MAX_VISIT_SCORE,
      );
      if (!turns.valid) return turns;

      return roundsLimitRejection(config, batch, existingTurnCount);
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

    return roundsLimitRejection(config, batch, existingTurnCount);
  },
};
