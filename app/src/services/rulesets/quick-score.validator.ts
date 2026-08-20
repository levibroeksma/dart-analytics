import type { EventsBatchRequestInput } from "@routes/types";
import {
  isVisualBoardCapture,
  VISUAL_BOARD_MODES,
} from "./visual-board.validator";
import type { BatchValidationResult } from "./types";

const QUICK_SCORE_CAPTURE_MODE = "RECREATIONAL";
const QUICK_SCORE_INPUT_MODE = "QUICK_SCORE";

/**
 * The mode pair every visit-total ruleset names in its rejection message.
 * Every visit-total ruleset now also supports `VISUAL_BOARD`
 * (`QUICK_SCORE_OR_VISUAL_BOARD_MODES` below), so nothing outside this
 * module names this pair alone anymore.
 */
const QUICK_SCORE_MODES = `${QUICK_SCORE_CAPTURE_MODE} + ${QUICK_SCORE_INPUT_MODE}`;

/**
 * Whether a session captures whole visit totals rather than individual darts.
 * TUOD supports exactly this one pair. 501 and Score Training also support
 * ANALYTICS + VISUAL_BOARD for a coordinate capture — see
 * `isQuickScoreOrVisualBoardCapture` for the combined check those two use at
 * session creation.
 */
export function isQuickScoreCapture(
  captureModeKey: string,
  inputModeKey: string,
): boolean {
  return (
    captureModeKey === QUICK_SCORE_CAPTURE_MODE &&
    inputModeKey === QUICK_SCORE_INPUT_MODE
  );
}

/** The mode pairs a dual-capture ruleset (501, Score Training) names in its rejection message. */
export const QUICK_SCORE_OR_VISUAL_BOARD_MODES = `${QUICK_SCORE_MODES} or ${VISUAL_BOARD_MODES}`;

/**
 * Whether a session's mode pair is one a dual-capture ruleset (501, Score
 * Training) actually implements: RECREATIONAL + QUICK_SCORE for a visit-total
 * capture, or ANALYTICS + VISUAL_BOARD for a coordinate capture. Named once
 * here rather than duplicated in each validator's `validateConfig`.
 */
export function isQuickScoreOrVisualBoardCapture(
  captureModeKey: string,
  inputModeKey: string,
): boolean {
  return (
    isQuickScoreCapture(captureModeKey, inputModeKey) ||
    isVisualBoardCapture(captureModeKey, inputModeKey)
  );
}

/** How many turns the batch carries, across every stage in it. */
function countBatchTurns(batch: EventsBatchRequestInput): number {
  return batch.stages.reduce((total, stage) => total + stage.turns.length, 0);
}

/**
 * The batch rule shared by every RECREATIONAL + QUICK_SCORE ruleset: a turn
 * carries a visit total within `0..maxTurnScore` and no dart rows at all. Only
 * `maxTurnScore` differs between them — 501 and Score Training read it from
 * `max_visit_score`, TUOD derives it from its ladder — so the walk itself lives
 * here rather than in three copies free to drift apart.
 */
export function validateQuickScoreTurns(
  batch: EventsBatchRequestInput,
  maxTurnScore: number,
): BatchValidationResult {
  for (const stage of batch.stages) {
    for (const turn of stage.turns) {
      if (turn.darts.length > 0) {
        return {
          valid: false,
          code: "VALIDATION_FAILED",
          issues: [
            `turn ${turn.clientKey} must have no dart rows (${QUICK_SCORE_MODES})`,
          ],
        };
      }
      if (turn.totalScore < 0 || turn.totalScore > maxTurnScore) {
        return {
          valid: false,
          code: "VALIDATION_FAILED",
          issues: [
            `turn ${turn.clientKey} totalScore must be between 0 and ${maxTurnScore}`,
          ],
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Whether the batch would push a ROUNDS session past the visit count its
 * configuration allows, counting the turns already persisted for it. A MINUTES
 * session is bounded by its countdown rather than by a visit count, so it never
 * exceeds one.
 */
export function exceedsRoundsLimit(
  config: Record<string, unknown>,
  batch: EventsBatchRequestInput,
  existingTurnCount: number,
): boolean {
  if (config.duration_type !== "ROUNDS") return false;
  const durationValue = config.duration_value as number;
  return existingTurnCount + countBatchTurns(batch) > durationValue;
}
