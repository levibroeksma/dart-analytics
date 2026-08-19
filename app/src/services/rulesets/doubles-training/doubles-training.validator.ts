import { DoublesTrainingConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import { createThreeDartValidator } from "../three-dart.validator";

/**
 * Doubles Training supports two mode pairs, and asserts nothing beyond the
 * shared three-dart rules.
 */
export const doublesTrainingValidator: RulesetValidator =
  createThreeDartValidator({
    label: "Doubles Training",
    configSchema: DoublesTrainingConfig,
    dartlessIssue: (clientKey) =>
      `turn ${clientKey} must carry dart rows — every Doubles Training visit carries at least one dart, never a dartless total`,
  });
