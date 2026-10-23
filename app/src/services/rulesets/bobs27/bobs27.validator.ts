import { Bobs27Config, Bobs27V2Config } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import type { ThreeDartValidatorOptions } from "@services/types";
import { createThreeDartValidator } from "../three-dart.validator";

function bobs27ValidatorFor(
  configSchema: ThreeDartValidatorOptions["configSchema"],
): RulesetValidator {
  return createThreeDartValidator({
    label: "Bob's 27",
    configSchema,
    dartlessIssue: (clientKey) =>
      `turn ${clientKey} must carry dart rows — every Bob's 27 visit is exactly 3 darts, hit or miss, never a dartless total`,
  });
}

/**
 * Bob's 27 supports two mode pairs, and asserts nothing beyond the shared
 * three-dart rules.
 */
export const bobs27Validator = bobs27ValidatorFor(Bobs27Config);

/** Bob's 27 V2: Easy. */
export const bobs27V2Validator = bobs27ValidatorFor(Bobs27V2Config);
