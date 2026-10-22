import {
  AroundTheClockConfig,
  AroundTheClockV2Config,
  AroundTheClockV3Config,
} from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import type { ThreeDartValidatorOptions } from "@services/types";
import {
  createThreeDartValidator,
  DETAILED_DARTS_MODES,
} from "../three-dart.validator";
import {
  isVisualBoardCapture,
  VISUAL_BOARD_MODES,
} from "../visual-board.validator";

const DARTLESS_ISSUE = (clientKey: string) =>
  `turn ${clientKey} must carry dart rows (${DETAILED_DARTS_MODES} or ${VISUAL_BOARD_MODES})`;

/**
 * Around the Clock supports two mode pairs, and asserts nothing beyond the
 * shared three-dart rules. Its dartless message names the two mode pairs
 * rather than a dart count: a visit can legitimately hold fewer than 3 darts,
 * because a BULL hit ends the session immediately.
 */
export const aroundTheClockValidator: RulesetValidator =
  createThreeDartValidator({
    label: "Around the Clock",
    configSchema: AroundTheClockConfig,
    dartlessIssue: DARTLESS_ISSUE,
  });

/**
 * Builds a variant validator: same mode pairs and batch rules as V1 (a lap
 * restart also closes a visit short). Outer single only needs a board
 * position, so it is refused outside ANALYTICS + VISUAL_BOARD — mirrors
 * `singlesTrainingV3Validator`'s Accuracy gate.
 */
function aroundTheClockVariantValidator(
  configSchema: ThreeDartValidatorOptions["configSchema"],
): RulesetValidator {
  const base = createThreeDartValidator({
    label: "Around the Clock",
    configSchema,
    dartlessIssue: DARTLESS_ISSUE,
  });
  return {
    ...base,
    validateConfig(input) {
      const result = base.validateConfig(input);
      if (
        result.valid &&
        result.config.segment_rule === "OUTER_SINGLE" &&
        !isVisualBoardCapture(input.captureModeKey, input.inputModeKey)
      ) {
        return {
          valid: false,
          issues: [
            "Around the Clock outer single only requires ANALYTICS + VISUAL_BOARD capture",
          ],
        };
      }
      return result;
    },
  };
}

/** Around the Clock V2: the training variants. */
export const aroundTheClockV2Validator = aroundTheClockVariantValidator(
  AroundTheClockV2Config,
);

/** Around the Clock V3: Nine Lives. */
export const aroundTheClockV3Validator = aroundTheClockVariantValidator(
  AroundTheClockV3Config,
);
