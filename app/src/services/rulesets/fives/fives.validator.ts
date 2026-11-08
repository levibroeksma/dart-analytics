import { FivesConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import { createThreeDartValidator } from "../three-dart.validator";

/**
 * Fives: the shared three-dart rules. A visit's `totalScore` stays its
 * darts' board-score sum; an off-board dart is a `MISS` dart with score 0.
 */
export const fivesValidator: RulesetValidator = createThreeDartValidator({
  label: "Fives",
  configSchema: FivesConfig,
  dartlessIssue: (clientKey) =>
    `turn ${clientKey} must carry dart rows — every Fives visit is up to 3 darts, never a dartless total`,
});
