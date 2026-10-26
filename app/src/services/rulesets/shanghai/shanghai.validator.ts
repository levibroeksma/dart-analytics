import { ShanghaiConfig, ShanghaiV2Config, ShanghaiV3Config } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import { createThreeDartValidator } from "../three-dart.validator";
import type { RoundTotalRule } from "@services/types";
import {
  scoreOnNumber,
  withRoundTotals,
} from "../visual-board-round-total.validator";

const DARTLESS_ISSUE = (clientKey: string) =>
  `turn ${clientKey} must carry dart rows — every Shanghai visit is exactly 3 darts, hit or miss, never a dartless total`;

type ShanghaiConfigSchema = Parameters<
  typeof createThreeDartValidator
>[0]["configSchema"];

/**
 * A closed visit's `totalScore` is the change it made to the seat's score
 * (`closedVisitTotal`): the points on the round's number, or 0 for a void
 * visit. A visit with no point on the number may instead be negative — the
 * Hard blank halving, which needs the running score the batch lacks.
 */
const rejectWrongPoints: RoundTotalRule = (turn, round, config) => {
  const rangeStart =
    typeof config.rangeStart === "number" ? config.rangeStart : 1;
  const points = scoreOnNumber(turn, rangeStart + round - 1);
  if (turn.totalScore === points || turn.totalScore === 0) return null;
  if (points === 0 && turn.totalScore < 0) return null;
  return `is neither the points scored in round ${round} (${points}), 0 for a void visit, nor a Hard halving`;
};

function shanghaiValidatorFor(configSchema: ShanghaiConfigSchema) {
  return withRoundTotals(
    createThreeDartValidator({
      label: "Shanghai",
      configSchema,
      dartlessIssue: DARTLESS_ISSUE,
    }),
    rejectWrongPoints,
  );
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
