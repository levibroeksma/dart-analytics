import { SinglesConfig, SinglesV2Config, SinglesV3Config } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import { createThreeDartValidator } from "../three-dart.validator";
import { isVisualBoardCapture } from "../visual-board.validator";

const DARTLESS_ISSUE = (clientKey: string) =>
  `turn ${clientKey} must carry dart rows — every Singles Training visit is exactly 3 darts, hit or miss, never a dartless total`;

/**
 * Singles Training supports two mode pairs, and asserts nothing beyond the
 * shared three-dart rules. `validateBatch` never reads `config` against a
 * schema — only `validateConfig` does — so V1 and V2 share this one
 * `createThreeDartValidator` shape, parameterised only by which config
 * schema `validateConfig` parses against, mirroring
 * `shanghai.validator.ts`'s V1/V2 split.
 */
export const singlesTrainingValidator: RulesetValidator =
  createThreeDartValidator({
    label: "Singles Training",
    configSchema: SinglesConfig,
    dartlessIssue: DARTLESS_ISSUE,
  });

export const singlesTrainingV2Validator: RulesetValidator =
  createThreeDartValidator({
    label: "Singles Training",
    configSchema: SinglesV2Config,
    dartlessIssue: DARTLESS_ISSUE,
  });

/**
 * V3 adds one rule V1/V2 have no need for: ACCURACY only means anything
 * under coordinate capture — only VISUAL_BOARD can tell an outer single
 * from an inner one, while DETAILED_DARTS's per-dart keypad only ever
 * emits a generic "SINGLE" zone key. Composes `createThreeDartValidator`'s
 * base validator (per `three-dart.validator.ts`'s own guidance) rather
 * than forking it.
 */
export const singlesTrainingV3Validator: RulesetValidator = (() => {
  const base = createThreeDartValidator({
    label: "Singles Training",
    configSchema: SinglesV3Config,
    dartlessIssue: DARTLESS_ISSUE,
  });
  return {
    ...base,
    validateConfig(input) {
      const result = base.validateConfig(input);
      if (
        result.valid &&
        result.config.scoring_mode === "ACCURACY" &&
        !isVisualBoardCapture(input.captureModeKey, input.inputModeKey)
      ) {
        return {
          valid: false,
          issues: [
            "Singles Training Accuracy mode requires ANALYTICS + VISUAL_BOARD capture",
          ],
        };
      }
      return result;
    },
  };
})();
