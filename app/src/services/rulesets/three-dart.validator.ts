import type { RulesetValidator } from "@services/interfaces";
import {
  isVisualBoardCapture,
  validateVisualBoardTurns,
  VISUAL_BOARD_MODES,
} from "./visual-board.validator";
import type { EventsBatchRequestInput } from "@routes/types";
import type {
  BatchValidationResult,
  ConfigValidationResult,
  ThreeDartValidatorOptions,
} from "@services/types";

const ALLOWED_CAPTURE_MODE = "RECREATIONAL";
const ALLOWED_INPUT_MODE = "DETAILED_DARTS";

/**
 * The per-dart keypad mode pair, as it reads in a rejection message.
 * Exported because Around the Clock's dartless message interpolates it.
 */
export const DETAILED_DARTS_MODES = `${ALLOWED_CAPTURE_MODE} + ${ALLOWED_INPUT_MODE}`;

/** Same ceiling every coordinate-capturing three-dart ruleset uses for a dartless keypad visit (3 darts, treble 20 max) — none of them has a `max_visit_score` config field to read one from. */
const DEFAULT_MAX_TURN_SCORE = 180;

/** Whether a session's mode pair is the per-dart keypad capture. */
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
 * Whether a session's mode pair is one a three-dart ruleset implements:
 * RECREATIONAL + DETAILED_DARTS for a per-dart keypad capture, or
 * ANALYTICS + VISUAL_BOARD for a coordinate capture.
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
 * Every visit, under either capture mode, carries at least one dart row —
 * never a dartless total. Returns the rejection, or `null` when every turn in
 * the batch carries at least one dart. The message is the caller's, because
 * why a visit may hold fewer than three darts is a fact about the game.
 */
function rejectDartlessTurn(
  batch: EventsBatchRequestInput,
  dartlessIssue: (clientKey: string) => string,
): BatchValidationResult | null {
  for (const stage of batch.stages) {
    for (const turn of stage.turns) {
      if (turn.darts.length === 0) {
        return {
          valid: false,
          code: "VALIDATION_FAILED",
          issues: [dartlessIssue(turn.clientKey)],
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
 * The validator five three-dart rulesets share. Each supports two mode pairs.
 * Under RECREATIONAL + DETAILED_DARTS the engine emits one dart row per
 * throw, so every turn in a batch must carry at least one and no dart's board
 * score may be negative. Under ANALYTICS + VISUAL_BOARD every dart carries a
 * landing coordinate, re-derived and cross-checked by
 * `validateVisualBoardTurns`.
 *
 * A ruleset needing more than these assertions composes rather than forks:
 * call this, then wrap the returned `validate*` method.
 */
export function createThreeDartValidator(
  options: ThreeDartValidatorOptions,
): RulesetValidator {
  const { label, configSchema, dartlessIssue } = options;

  return {
    validateConfig({
      config,
      captureModeKey,
      inputModeKey,
    }): ConfigValidationResult {
      if (!isDetailedDartsOrVisualBoardCapture(captureModeKey, inputModeKey)) {
        return {
          valid: false,
          issues: [
            `${label} V1 only supports ${DETAILED_DARTS_MODES} or ${VISUAL_BOARD_MODES}`,
          ],
        };
      }
      const parsed = configSchema.safeParse(config);
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
      captureModeKey?: string;
      inputModeKey?: string;
    }): BatchValidationResult {
      const dartlessRejection = rejectDartlessTurn(batch, dartlessIssue);
      if (dartlessRejection) return dartlessRejection;

      if (isVisualBoardCapture(captureModeKey ?? "", inputModeKey ?? "")) {
        return validateVisualBoardTurns(batch, DEFAULT_MAX_TURN_SCORE);
      }

      const negativeScoreRejection = rejectNegativeDartScore(batch);
      if (negativeScoreRejection) return negativeScoreRejection;

      return { valid: true };
    },
  };
}
