import { AroundTheClockConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import type {
  BatchValidationResult,
  ConfigValidationResult,
} from "@services/types";

const ALLOWED_CAPTURE_MODE = "RECREATIONAL";
const ALLOWED_INPUT_MODE = "DETAILED_DARTS";

/**
 * Around the Clock is RECREATIONAL + DETAILED_DARTS: its engine emits one
 * dart row per throw, so every turn in a batch must carry at least one and
 * no dart's board score may be negative. A turn can legitimately hold fewer
 * than 3 darts — a BULL hit ends the session immediately, so the visit that
 * completes it can close at 1 or 2 darts.
 */
export const aroundTheClockValidator: RulesetValidator = {
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
          `Around the Clock V1 only supports ${ALLOWED_CAPTURE_MODE} + ${ALLOWED_INPUT_MODE}`,
        ],
      };
    }
    const parsed = AroundTheClockConfig.safeParse(config);
    if (!parsed.success) {
      return { valid: false, issues: parsed.error.issues };
    }
    return { valid: true, config: parsed.data };
  },

  validateBatch({ batch }): BatchValidationResult {
    for (const stage of batch.stages) {
      for (const turn of stage.turns) {
        if (turn.darts.length === 0) {
          return {
            valid: false,
            code: "VALIDATION_FAILED",
            issues: [
              `turn ${turn.clientKey} must carry dart rows (RECREATIONAL + DETAILED_DARTS)`,
            ],
          };
        }
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
