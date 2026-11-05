import {
  exceedsRoundsLimit,
  isQuickScoreCapture,
  validateQuickScoreTurns,
} from "./quick-score.validator";
import {
  isVisualBoardCapture,
  validateVisualBoardTurns,
} from "./visual-board.validator";
import type {
  BatchValidationResult,
  ModedBatchValidationInput,
  ScoredBatchOptions,
} from "@services/types";

/**
 * Rejects a batch that pushes any seat past a ROUNDS session's
 * `duration_value`, naming the cap in `limitNoun`; otherwise accepts.
 */
function roundsLimitRejection(
  { config, batch, existingTurnCounts }: ModedBatchValidationInput,
  limitNoun: ScoredBatchOptions["limitNoun"],
): BatchValidationResult {
  if (exceedsRoundsLimit(config, batch, existingTurnCounts)) {
    return {
      valid: false,
      code: "VALIDATION_FAILED",
      issues: [`session is limited to ${config.duration_value} ${limitNoun}`],
    };
  }
  return { valid: true };
}

/**
 * `validateBatch` for a ruleset whose turns are visit totals under
 * RECREATIONAL + QUICK_SCORE or coordinate darts (or dartless keypad visits)
 * under ANALYTICS + VISUAL_BOARD, each bounded by `maxTurnScore`. Any other
 * mode pair is refused. The ROUNDS cap always applies on the quick-score path
 * and on the visual-board path only when `limitOnVisualBoard`.
 */
export function validateScoredBatch(
  input: ModedBatchValidationInput,
  { maxTurnScore, limitNoun, limitOnVisualBoard }: ScoredBatchOptions,
): BatchValidationResult {
  const { batch, captureModeKey, inputModeKey } = input;

  if (isVisualBoardCapture(captureModeKey, inputModeKey)) {
    const turns = validateVisualBoardTurns(batch, maxTurnScore);
    if (!turns.valid || !limitOnVisualBoard) return turns;
    return roundsLimitRejection(input, limitNoun);
  }

  if (!isQuickScoreCapture(captureModeKey, inputModeKey)) {
    return {
      valid: false,
      code: "VALIDATION_FAILED",
      issues: [`unsupported mode pair ${captureModeKey} + ${inputModeKey}`],
    };
  }

  const turns = validateQuickScoreTurns(batch, maxTurnScore);
  if (!turns.valid) return turns;

  return roundsLimitRejection(input, limitNoun);
}
