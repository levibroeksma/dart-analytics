import { Bobs27Config } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import { createThreeDartValidator } from "../three-dart.validator";

/**
 * Bob's 27 supports two mode pairs, and asserts nothing beyond the shared
 * three-dart rules.
 */
export const bobs27Validator: RulesetValidator = createThreeDartValidator({
  label: "Bob's 27",
  configSchema: Bobs27Config,
  dartlessIssue: (clientKey) =>
    `turn ${clientKey} must carry dart rows — every Bob's 27 visit is exactly 3 darts, hit or miss, never a dartless total`,
});
