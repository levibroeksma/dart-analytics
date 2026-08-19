import { AroundTheClockConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import {
  createThreeDartValidator,
  DETAILED_DARTS_MODES,
} from "../three-dart.validator";
import { VISUAL_BOARD_MODES } from "../visual-board.validator";

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
    dartlessIssue: (clientKey) =>
      `turn ${clientKey} must carry dart rows (${DETAILED_DARTS_MODES} or ${VISUAL_BOARD_MODES})`,
  });
