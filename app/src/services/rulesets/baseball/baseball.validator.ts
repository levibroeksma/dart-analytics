import { BaseballConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import { createThreeDartValidator } from "../three-dart.validator";
import {
  scoreOnNumber,
  withRoundTotals,
} from "../visual-board-round-total.validator";

const threeDartValidator = createThreeDartValidator({
  label: "Baseball Darts",
  configSchema: BaseballConfig,
  dartlessIssue: (clientKey) =>
    `turn ${clientKey} must carry dart rows — every Baseball Darts inning is exactly 3 darts, hit or miss, never a dartless total`,
});

/**
 * Baseball Darts: the shared three-dart rules. A closed inning's `totalScore`
 * is its runs (darts on the inning's own number), or 0 for a void visit.
 */
export const baseballValidator: RulesetValidator = withRoundTotals(
  threeDartValidator,
  (turn, inning) => {
    const runs = scoreOnNumber(turn, inning);
    return turn.totalScore === runs || turn.totalScore === 0
      ? null
      : `is neither the runs scored in inning ${inning} (${runs}) nor 0 for a void visit`;
  },
);
