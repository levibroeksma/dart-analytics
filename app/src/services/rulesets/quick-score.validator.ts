import type { EventsBatchRequestInput } from "@routes/types";
import type { BatchValidationResult } from "./types";

const QUICK_SCORE_CAPTURE_MODE = "RECREATIONAL";
const QUICK_SCORE_INPUT_MODE = "QUICK_SCORE";

/** The mode pair every visit-total ruleset names in its rejection message. */
export const QUICK_SCORE_MODES = `${QUICK_SCORE_CAPTURE_MODE} + ${QUICK_SCORE_INPUT_MODE}`;

/**
 * Whether a session captures whole visit totals rather than individual darts.
 * Score Training, 501 and TUOD all support exactly this one pair, so the pair
 * itself is named once here instead of in each of them.
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
