import { SinglesConfig, SinglesV2Config } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import { createThreeDartValidator } from "../three-dart.validator";

const DARTLESS_ISSUE = (clientKey: string) =>
  `turn ${clientKey} must carry dart rows — every Singles Training visit is exactly 3 darts, hit or miss, never a dartless total`;

/**
 * Singles Training supports two mode pairs, and asserts nothing beyond the
 * shared three-dart rules. `validateBatch` never reads `config` against a
 * schema — only `validateConfig` does — so V1 and V2 share this one
 * `createThreeDartValidator` shape, parameterised only by which config
 * schema `validateConfig` parses against, mirroring
 * `shanghai.validator.ts`'s V1/V2 split.
 */
export const singlesTrainingValidator: RulesetValidator =
  createThreeDartValidator({
    label: "Singles Training",
    configSchema: SinglesConfig,
    dartlessIssue: DARTLESS_ISSUE,
  });

export const singlesTrainingV2Validator: RulesetValidator =
  createThreeDartValidator({
    label: "Singles Training",
    configSchema: SinglesV2Config,
    dartlessIssue: DARTLESS_ISSUE,
  });
