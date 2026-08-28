import { OneTwentyOneConfig, OneTwentyOneV2Config } from "@lib/types";
import type { z } from "zod";
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

/** The highest total a single 121 visit can legitimately carry — the highest three-dart score on a standard board (T20 T20 T20). */
const MAX_VISIT_SCORE = 180;

/**
 * 121 supports two mode pairs, unchanged between ruleset versions. Under
 * RECREATIONAL + QUICK_SCORE every turn is a visit total with no dart rows,
 * capped at 180. Under ANALYTICS + VISUAL_BOARD every dart carries a landing
 * coordinate, re-derived and cross-checked by `validateVisualBoardTurns` —
 * mirrors `five-oh-one.validator.ts`. `validateBatch` never reads `config`
 * against a schema — only `validateConfig` does — so `121_V1` and `121_V2`
 * share this one implementation, parameterised only by which config schema
 * `validateConfig` parses against.
 */
export function createOneTwentyOneValidator(
  configSchema: z.ZodTypeAny,
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
          issues: [`121 only supports ${QUICK_SCORE_OR_VISUAL_BOARD_MODES}`],
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
      existingTurnCounts: ExistingTurnCounts;
      captureModeKey: string;
      inputModeKey: string;
    }): BatchValidationResult {
      if (isVisualBoardCapture(captureModeKey, inputModeKey)) {
        return validateVisualBoardTurns(batch, MAX_VISIT_SCORE);
      }

      if (!isQuickScoreCapture(captureModeKey, inputModeKey)) {
        return {
          valid: false,
          code: "VALIDATION_FAILED",
          issues: [`unsupported mode pair ${captureModeKey} + ${inputModeKey}`],
        };
      }

      return validateQuickScoreTurns(batch, MAX_VISIT_SCORE);
    },
  };
}

export const oneTwentyOneValidator: RulesetValidator =
  createOneTwentyOneValidator(OneTwentyOneConfig);

export const oneTwentyOneV2Validator: RulesetValidator =
  createOneTwentyOneValidator(OneTwentyOneV2Config);
