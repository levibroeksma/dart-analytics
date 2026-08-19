import { ShanghaiConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import { createThreeDartValidator } from "../three-dart.validator";

/**
 * Shanghai supports two mode pairs, and asserts nothing beyond the shared
 * three-dart rules: a non-empty dart list per visit under either capture
 * mode, non-negative board scores under RECREATIONAL + DETAILED_DARTS, and
 * coordinate re-derivation under ANALYTICS + VISUAL_BOARD.
 */
export const shanghaiValidator: RulesetValidator = createThreeDartValidator({
  label: "Shanghai",
  configSchema: ShanghaiConfig,
  dartlessIssue: (clientKey) =>
    `turn ${clientKey} must carry dart rows — every Shanghai visit is exactly 3 darts, hit or miss, never a dartless total`,
});
