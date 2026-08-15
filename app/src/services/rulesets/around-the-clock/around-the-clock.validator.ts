import { AroundTheClockConfig } from "@lib/types";
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

/** Whether a session's mode pair is Around the Clock's own per-dart keypad capture. */
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
 * Whether a session's mode pair is one Around the Clock actually implements:
 * RECREATIONAL + DETAILED_DARTS for a per-dart keypad capture, or
 * ANALYTICS + VISUAL_BOARD for a coordinate capture. Mirrors
 * `singles-training.validator.ts`'s `isDetailedDartsOrVisualBoardCapture`.
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
 * Every Around the Clock visit, under either capture mode, carries at least
 * one dart row — never a dartless total. A turn can legitimately hold fewer
 * than 3 darts (a BULL hit ends the session immediately), so this only
 * checks for zero darts, never an exact count. Returns the rejection, or
 * `null` when every turn in the batch carries at least one dart.
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
            `turn ${turn.clientKey} must carry dart rows (${DETAILED_DARTS_MODES} or ${VISUAL_BOARD_MODES})`,
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

/** Same ceiling every other coordinate-capturing ruleset uses for a dartless keypad visit (3 darts, treble 20 max) — Around the Clock has no `max_visit_score` config field to read one from. */
const DEFAULT_MAX_TURN_SCORE = 180;

/**
 * Around the Clock supports two mode pairs. Under RECREATIONAL +
 * DETAILED_DARTS its engine emits one dart row per throw, so every turn in a
 * batch must carry at least one and no dart's board score may be negative.
 * Under ANALYTICS + VISUAL_BOARD every dart carries a landing coordinate,
 * re-derived and cross-checked by `validateVisualBoardTurns`.
 */
export const aroundTheClockValidator: RulesetValidator = {
  validateConfig({
    config,
    captureModeKey,
    inputModeKey,
  }): ConfigValidationResult {
    if (!isDetailedDartsOrVisualBoardCapture(captureModeKey, inputModeKey)) {
      return {
        valid: false,
        issues: [
          `Around the Clock V1 only supports ${DETAILED_DARTS_MODES} or ${VISUAL_BOARD_MODES}`,
        ],
      };
    }
    const parsed = AroundTheClockConfig.safeParse(config);
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
