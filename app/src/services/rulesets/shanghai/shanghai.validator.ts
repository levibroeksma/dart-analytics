import { ShanghaiConfig, ShanghaiV2Config, ShanghaiV3Config } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import { createThreeDartValidator } from "../three-dart.validator";

const DARTLESS_ISSUE = (clientKey: string) =>
  `turn ${clientKey} must carry dart rows — every Shanghai visit is exactly 3 darts, hit or miss, never a dartless total`;

type ShanghaiConfigSchema = Parameters<
  typeof createThreeDartValidator
>[0]["configSchema"];

function shanghaiValidatorFor(configSchema: ShanghaiConfigSchema) {
  return createThreeDartValidator({
    label: "Shanghai",
    configSchema,
    dartlessIssue: DARTLESS_ISSUE,
  });
}

/**
 * Shanghai supports two mode pairs, and asserts nothing beyond the shared
 * three-dart rules: a non-empty dart list per visit under either capture
 * mode, non-negative board scores under RECREATIONAL + DETAILED_DARTS, and
 * coordinate re-derivation under ANALYTICS + VISUAL_BOARD. `validateBatch`
 * never reads `config` against a schema — only `validateConfig` does — so
 * every version shares one shape, parameterised only by which config schema
 * `validateConfig` parses against, mirroring `one-twenty-one.validator.ts`'s
 * V1/V2 split.
 */
export const shanghaiValidator: RulesetValidator =
  shanghaiValidatorFor(ShanghaiConfig);

export const shanghaiV2Validator: RulesetValidator =
  shanghaiValidatorFor(ShanghaiV2Config);

export const shanghaiV3Validator: RulesetValidator =
  shanghaiValidatorFor(ShanghaiV3Config);
