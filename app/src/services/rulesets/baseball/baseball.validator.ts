import { BaseballConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import { createThreeDartValidator } from "../three-dart.validator";

/** Baseball Darts: the two mode pairs and nothing beyond the shared three-dart rules. */
export const baseballValidator: RulesetValidator = createThreeDartValidator({
  label: "Baseball Darts",
  configSchema: BaseballConfig,
  dartlessIssue: (clientKey) =>
    `turn ${clientKey} must carry dart rows — every Baseball Darts inning is exactly 3 darts, hit or miss, never a dartless total`,
});
