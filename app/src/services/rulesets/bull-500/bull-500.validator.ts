import { Bull500Config } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import type { BatchValidationResult } from "@services/types";
import { createThreeDartValidator } from "../three-dart.validator";

const MAX_VISIT_DARTS = 3;

const threeDartValidator = createThreeDartValidator({
  label: "Bull 500",
  configSchema: Bull500Config,
  dartlessIssue: (clientKey) =>
    `turn ${clientKey} must carry dart rows — every Bull 500 visit is up to 3 darts, never a dartless total`,
});

/**
 * Bull 500: the shared three-dart rules, plus a cap of three darts a turn
 * (the shared builder sets none). A visit's `totalScore` stays its darts'
 * board-score sum (a bull stores 25 or 50); game points are derived.
 */
export const bull500Validator: RulesetValidator = {
  validateConfig: (input) => threeDartValidator.validateConfig(input),
  validateBatch(input) {
    for (const stage of input.batch.stages) {
      for (const turn of stage.turns) {
        if (turn.darts.length > MAX_VISIT_DARTS) {
          const rejection: BatchValidationResult = {
            valid: false,
            code: "VALIDATION_FAILED",
            issues: [
              `turn ${turn.clientKey} holds ${turn.darts.length} darts — a Bull 500 visit is at most ${MAX_VISIT_DARTS}`,
            ],
          };
          return rejection;
        }
      }
    }
    return threeDartValidator.validateBatch(input);
  },
};
