import { Bobs27Config } from "@lib/types";
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

/** Same ceiling every other coordinate-capturing ruleset uses for a dartless keypad visit (3 darts, treble 20 max) — Bob's 27 has no `max_visit_score` config field to read one from. */
const DEFAULT_MAX_TURN_SCORE = 180;

/** Whether a session's mode pair is Bob's 27's own per-dart keypad capture. */
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
 * Whether a session's mode pair is one Bob's 27 actually implements:
 * RECREATIONAL + DETAILED_DARTS for a per-dart keypad capture, or
 * ANALYTICS + VISUAL_BOARD for a coordinate capture. Named once here rather
 * than duplicated inline, mirroring `isQuickScoreOrVisualBoardCapture`
 * (`quick-score.validator.ts`) for the DETAILED_DARTS-vs-VISUAL_BOARD case.
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
 * Bob's 27 supports two mode pairs. Under RECREATIONAL + DETAILED_DARTS its
 * engine emits one dart row per throw, so every turn in a batch must carry at
 * least one and no dart's board score may be negative. Under
 * ANALYTICS + VISUAL_BOARD every dart carries a landing coordinate, re-derived
 * and cross-checked by `validateVisualBoardTurns`.
 */
export const bobs27Validator: RulesetValidator = {
  validateConfig({
    config,
    captureModeKey,
    inputModeKey,
  }): ConfigValidationResult {
    if (!isDetailedDartsOrVisualBoardCapture(captureModeKey, inputModeKey)) {
      return {
        valid: false,
        issues: [
          `Bob's 27 V1 only supports ${DETAILED_DARTS_MODES} or ${VISUAL_BOARD_MODES}`,
        ],
      };
    }
    const parsed = Bobs27Config.safeParse(config);
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
    for (const stage of batch.stages) {
      for (const turn of stage.turns) {
        if (turn.darts.length === 0) {
          return {
            valid: false,
            code: "VALIDATION_FAILED",
            issues: [
              `turn ${turn.clientKey} must carry dart rows — every Bob's 27 visit is exactly 3 darts, hit or miss, never a dartless total`,
            ],
          };
        }
      }
    }

    if (isVisualBoardCapture(captureModeKey, inputModeKey)) {
      return validateVisualBoardTurns(batch, DEFAULT_MAX_TURN_SCORE);
    }

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

    return { valid: true };
  },
};
