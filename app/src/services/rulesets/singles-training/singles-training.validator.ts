import { SinglesConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import { createThreeDartValidator } from "../three-dart.validator";

/**
 * Singles Training supports two mode pairs, and asserts nothing beyond the
 * shared three-dart rules.
 */
export const singlesTrainingValidator: RulesetValidator =
  createThreeDartValidator({
    label: "Singles Training",
    configSchema: SinglesConfig,
    dartlessIssue: (clientKey) =>
      `turn ${clientKey} must carry dart rows — every Singles Training visit is exactly 3 darts, hit or miss, never a dartless total`,
  });
