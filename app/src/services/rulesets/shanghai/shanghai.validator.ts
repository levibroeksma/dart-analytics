import { ShanghaiConfig, ShanghaiV2Config } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import { createThreeDartValidator } from "../three-dart.validator";

const DARTLESS_ISSUE = (clientKey: string) =>
  `turn ${clientKey} must carry dart rows — every Shanghai visit is exactly 3 darts, hit or miss, never a dartless total`;

/**
 * Shanghai supports two mode pairs, and asserts nothing beyond the shared
 * three-dart rules: a non-empty dart list per visit under either capture
 * mode, non-negative board scores under RECREATIONAL + DETAILED_DARTS, and
 * coordinate re-derivation under ANALYTICS + VISUAL_BOARD. `validateBatch`
 * never reads `config` against a schema — only `validateConfig` does — so
 * V1 and V2 share this one `createThreeDartValidator` shape, parameterised
 * only by which config schema `validateConfig` parses against, mirroring
 * `one-twenty-one.validator.ts`'s V1/V2 split.
 */
export const shanghaiValidator: RulesetValidator = createThreeDartValidator({
  label: "Shanghai",
  configSchema: ShanghaiConfig,
  dartlessIssue: DARTLESS_ISSUE,
});

export const shanghaiV2Validator: RulesetValidator = createThreeDartValidator({
  label: "Shanghai",
  configSchema: ShanghaiV2Config,
  dartlessIssue: DARTLESS_ISSUE,
});
