import { TuodConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import {
  QUICK_SCORE_OR_VISUAL_BOARD_MODES,
  isQuickScoreOrVisualBoardCapture,
} from "../quick-score.validator";
import { validateScoredBatch } from "../scored-batch.validator";
import { validateModeGatedConfig } from "../mode-gated-config";
import type {
  BatchValidationResult,
  ConfigValidationResult,
  ModedBatchValidationInput,
} from "@services/types";

/** The highest three-dart double-out finish on a standard board (T20 T20 D25). */
const MAX_THREE_DART_CHECKOUT = 170;

/**
 * The highest total one TUOD turn can legitimately carry, under either
 * capture mode. A failed attempt scores 0 and a successful one scores exactly
 * the target it was thrown at, so the bound is the highest target the ladder
 * can ever present — capped by the fact that no checkout above 170 exists at
 * all.
 *
 * A ROUNDS session caps the attempt count at `duration_value`, and the ladder
 * climbs at most `finish_bonus` per attempt from `starting_target`, so even an
 * all-success session cannot present a target above
 * `starting_target + finish_bonus * (duration_value - 1)`. A MINUTES session
 * has no attempt cap, so only the checkout ceiling constrains it. The tighter
 * of the two is the real bound: for the seeded 10-round preset that is 131,
 * well below 170, and a turn claiming more could not have been produced by any
 * play of that configuration.
 */
function maxTurnScore(config: Record<string, unknown>): number {
  if (config.duration_type !== "ROUNDS") return MAX_THREE_DART_CHECKOUT;

  const startingTarget = config.starting_target as number;
  const finishBonus = config.finish_bonus as number;
  const durationValue = config.duration_value as number;
  const ladderCeiling = startingTarget + finishBonus * (durationValue - 1);
  return Math.min(ladderCeiling, MAX_THREE_DART_CHECKOUT);
}

/**
 * TUOD supports two mode pairs. Under RECREATIONAL + QUICK_SCORE every turn
 * is a whole attempt with no dart rows. Under ANALYTICS + VISUAL_BOARD every
 * dart carries a landing coordinate, re-derived and cross-checked by
 * `validateVisualBoardTurns` — mirrors `one-twenty-one.validator.ts`.
 */
export const tuodValidator: RulesetValidator = {
  validateConfig({
    config,
    captureModeKey,
    inputModeKey,
  }): ConfigValidationResult {
    return validateModeGatedConfig(
      TuodConfig,
      config,
      isQuickScoreOrVisualBoardCapture(captureModeKey, inputModeKey),
      `TUOD V1 only supports ${QUICK_SCORE_OR_VISUAL_BOARD_MODES}`,
    );
  },

  validateBatch(input: ModedBatchValidationInput): BatchValidationResult {
    return validateScoredBatch(input, {
      maxTurnScore: maxTurnScore(input.config),
      limitNoun: "attempts",
      limitOnVisualBoard: false,
    });
  },
};
