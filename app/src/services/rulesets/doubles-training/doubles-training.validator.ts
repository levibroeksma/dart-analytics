import { DoublesTrainingConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import {
  isVisualBoardCapture,
  validateVisualBoardTurns,
  VISUAL_BOARD_MODES,
} from "../visual-board.validator";
import type { EventsBatchRequestInput } from "@routes/types";
import type {
  BatchValidationResult,
  ConfigValidationResult,
} from "@services/types";

const ALLOWED_CAPTURE_MODE = "RECREATIONAL";
const ALLOWED_INPUT_MODE = "DETAILED_DARTS";
const DETAILED_DARTS_MODES = `${ALLOWED_CAPTURE_MODE} + ${ALLOWED_INPUT_MODE}`;

/** Same ceiling every other coordinate-capturing ruleset uses for a dartless keypad visit (3 darts, treble 20 max) — Doubles Training has no `max_visit_score` config field to read one from. */
const DEFAULT_MAX_TURN_SCORE = 180;

/** Whether a session's mode pair is Doubles Training's own per-dart keypad capture. */
function isDetailedDartsCapture(
  captureModeKey: string,
  inputModeKey: string,
): boolean {
  return (
    captureModeKey === ALLOWED_CAPTURE_MODE &&
    inputModeKey === ALLOWED_INPUT_MODE
  );
}

/**
 * Whether a session's mode pair is one Doubles Training actually implements:
 * RECREATIONAL + DETAILED_DARTS for a per-dart keypad capture, or
 * ANALYTICS + VISUAL_BOARD for a coordinate capture. Mirrors
 * `bobs27.validator.ts`'s `isDetailedDartsOrVisualBoardCapture`.
 */
function isDetailedDartsOrVisualBoardCapture(
  captureModeKey: string,
  inputModeKey: string,
): boolean {
  return (
    isDetailedDartsCapture(captureModeKey, inputModeKey) ||
    isVisualBoardCapture(captureModeKey, inputModeKey)
  );
}

/**
 * Every Doubles Training visit, under either capture mode, carries at least
 * one dart row — a hit can end a visit after 1 or 2 darts, but never with
 * zero. Returns the rejection, or `null` when every turn in the batch carries
 * at least one dart.
 */
function rejectDartlessTurn(
  batch: EventsBatchRequestInput,
): BatchValidationResult | null {
  for (const stage of batch.stages) {
    for (const turn of stage.turns) {
      if (turn.darts.length === 0) {
        return {
          valid: false,
          code: "VALIDATION_FAILED",
          issues: [
            `turn ${turn.clientKey} must carry dart rows — every Doubles Training visit carries at least one dart, never a dartless total`,
          ],
        };
      }
    }
  }
  return null;
}

/**
 * Under RECREATIONAL + DETAILED_DARTS every dart's board score must be
 * non-negative. Returns the rejection, or `null` when every dart in the batch
 * clears that floor.
 */
function rejectNegativeDartScore(
  batch: EventsBatchRequestInput,
): BatchValidationResult | null {
  for (const stage of batch.stages) {
    for (const turn of stage.turns) {
      for (const dart of turn.darts) {
        if (dart.score < 0) {
          return {
            valid: false,
            code: "VALIDATION_FAILED",
            issues: [
              `turn ${turn.clientKey} dart ${dart.sequence} score must be non-negative`,
            ],
          };
        }
      }
    }
  }
  return null;
}

/**
 * Doubles Training supports two mode pairs. Under RECREATIONAL +
 * DETAILED_DARTS its engine emits one dart row per throw, so every turn in a
 * batch must carry at least one and no dart's board score may be negative.
 * Under ANALYTICS + VISUAL_BOARD every dart carries a landing coordinate,
 * re-derived and cross-checked by `validateVisualBoardTurns`.
 */
export const doublesTrainingValidator: RulesetValidator = {
  validateConfig({
    config,
    captureModeKey,
    inputModeKey,
  }): ConfigValidationResult {
    if (!isDetailedDartsOrVisualBoardCapture(captureModeKey, inputModeKey)) {
      return {
        valid: false,
        issues: [
          `Doubles Training V1 only supports ${DETAILED_DARTS_MODES} or ${VISUAL_BOARD_MODES}`,
        ],
      };
    }
    const parsed = DoublesTrainingConfig.safeParse(config);
    if (!parsed.success) {
      return { valid: false, issues: parsed.error.issues };
    }
    return { valid: true, config: parsed.data };
  },

  validateBatch({
    batch,
    captureModeKey,
    inputModeKey,
  }: {
    config: Record<string, unknown>;
    batch: EventsBatchRequestInput;
    existingTurnCount: number;
    captureModeKey: string;
    inputModeKey: string;
  }): BatchValidationResult {
    const dartlessRejection = rejectDartlessTurn(batch);
    if (dartlessRejection) return dartlessRejection;

    if (isVisualBoardCapture(captureModeKey, inputModeKey)) {
      return validateVisualBoardTurns(batch, DEFAULT_MAX_TURN_SCORE);
    }

    const negativeScoreRejection = rejectNegativeDartScore(batch);
    if (negativeScoreRejection) return negativeScoreRejection;

    return { valid: true };
  },
};
