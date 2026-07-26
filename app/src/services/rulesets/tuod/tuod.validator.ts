import { TuodConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import {
  QUICK_SCORE_MODES,
  exceedsRoundsLimit,
  isQuickScoreCapture,
  validateQuickScoreTurns,
} from "../quick-score.validator";
import type {
  BatchValidationResult,
  ConfigValidationResult,
} from "@services/types";

/** The highest three-dart double-out finish on a standard board (T20 T20 D25). */
const MAX_THREE_DART_CHECKOUT = 170;

/**
 * The highest total one TUOD turn can legitimately carry. A failed attempt
 * scores 0 and a successful one scores exactly the target it was thrown at, so
 * the bound is the highest target the ladder can ever present — capped by the
 * fact that no checkout above 170 exists at all.
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
 * TUOD is RECREATIONAL + QUICK_SCORE: one attempt per turn, carrying the
 * checked-out target or 0, with no dart rows — the ladder depends only on
 * whether the attempt succeeded, so V1 captures no per-dart facts.
 */
export const tuodValidator: RulesetValidator = {
  validateConfig({
    config,
    captureModeKey,
    inputModeKey,
  }): ConfigValidationResult {
    if (!isQuickScoreCapture(captureModeKey, inputModeKey)) {
      return {
        valid: false,
        issues: [`TUOD V1 only supports ${QUICK_SCORE_MODES}`],
      };
    }
    const parsed = TuodConfig.safeParse(config);
    if (!parsed.success) {
      return { valid: false, issues: parsed.error.issues };
    }
    return { valid: true, config: parsed.data };
  },

  validateBatch({ config, batch, existingTurnCount }): BatchValidationResult {
    const turns = validateQuickScoreTurns(batch, maxTurnScore(config));
    if (!turns.valid) return turns;

    if (exceedsRoundsLimit(config, batch, existingTurnCount)) {
      return {
        valid: false,
        code: "VALIDATION_FAILED",
        issues: [`session is limited to ${config.duration_value} attempts`],
      };
    }

    return { valid: true };
  },
};
