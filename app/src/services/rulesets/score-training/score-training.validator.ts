import type { RulesetValidator } from "../interfaces";
import type { BatchValidationResult, ConfigValidationResult } from "../types";
import { ScoreTrainingConfig } from "./types";

const ALLOWED_CAPTURE_MODE = "RECREATIONAL";
const ALLOWED_INPUT_MODE = "QUICK_SCORE";

export const scoreTrainingValidator: RulesetValidator = {
  validateConfig({
    config,
    captureModeKey,
    inputModeKey,
  }): ConfigValidationResult {
    if (
      captureModeKey !== ALLOWED_CAPTURE_MODE ||
      inputModeKey !== ALLOWED_INPUT_MODE
    ) {
      return {
        valid: false,
        issues: [
          `Score Training V1 only supports ${ALLOWED_CAPTURE_MODE} + ${ALLOWED_INPUT_MODE}`,
        ],
      };
    }
    const parsed = ScoreTrainingConfig.safeParse(config);
    if (!parsed.success) {
      return { valid: false, issues: parsed.error.issues };
    }
    return { valid: true, config: parsed.data };
  },

  validateBatch({ config, batch, existingTurnCount }): BatchValidationResult {
    const durationType = config.duration_type as "ROUNDS" | "MINUTES";
    const durationValue = config.duration_value as number;

    let newTurnCount = 0;
    for (const stage of batch.stages) {
      for (const turn of stage.turns) {
        newTurnCount++;
        if (turn.darts.length > 0) {
          return {
            valid: false,
            code: "VALIDATION_FAILED",
            issues: [
              `turn ${turn.clientKey} must have no dart rows (RECREATIONAL + QUICK_SCORE)`,
            ],
          };
        }
        if (turn.totalScore < 0 || turn.totalScore > 180) {
          return {
            valid: false,
            code: "VALIDATION_FAILED",
            issues: [
              `turn ${turn.clientKey} totalScore must be between 0 and 180`,
            ],
          };
        }
      }
    }

    if (
      durationType === "ROUNDS" &&
      existingTurnCount + newTurnCount > durationValue
    ) {
      return {
        valid: false,
        code: "VALIDATION_FAILED",
        issues: [`session is limited to ${durationValue} visits`],
      };
    }

    return { valid: true };
  },
};
