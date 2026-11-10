import { AceConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import { createThreeDartValidator } from "../three-dart.validator";

/**
 * Ace: the shared three-dart rules. A visit's `totalScore` stays its darts'
 * board-score sum and a dart's `score` its board score; Ace points are
 * derived on read from the round's target, never stored.
 */
export const aceValidator: RulesetValidator = createThreeDartValidator({
  label: "Ace",
  configSchema: AceConfig,
  dartlessIssue: (clientKey) =>
    `turn ${clientKey} must carry dart rows — every Ace visit is up to 3 darts, never a dartless total`,
});
