import type { RulesetValidator } from "@services/interfaces";
import type { EventsBatchRequestInput } from "@routes/types";
import type {
  BatchValidationResult,
  ThreeDartValidatorOptions,
} from "@services/types";
import {
  createThreeDartValidator,
  DETAILED_DARTS_MODES,
} from "./three-dart.validator";
import { VISUAL_BOARD_MODES } from "./visual-board.validator";

const MAX_DARTS_PER_VISIT = 3;

/**
 * Darts carry no intent (any objective is a legitimate aim) and a visit
 * holds at most 3 darts. Returns the rejection, or null.
 */
function rejectMarksCloseTurn(
  label: string,
  batch: EventsBatchRequestInput,
): BatchValidationResult | null {
  for (const stage of batch.stages) {
    for (const turn of stage.turns) {
      if (turn.darts.length > MAX_DARTS_PER_VISIT) {
        return {
          valid: false,
          code: "VALIDATION_FAILED",
          issues: [`turn ${turn.clientKey} holds more than 3 darts`],
        };
      }
      const aimed = turn.darts.find(
        (dart) =>
          dart.intendedTargetNumber !== null || dart.intendedZoneKey !== null,
      );
      if (aimed) {
        return {
          valid: false,
          code: "VALIDATION_FAILED",
          issues: [
            `turn ${turn.clientKey} dart ${aimed.sequence} must carry no intent — ${label} stores none`,
          ],
        };
      }
    }
  }
  return null;
}

/**
 * A marks-close game (Cricket, Tactics): the shared three-dart rules, plus no
 * intent and at most 3 darts per visit. A visit may hold fewer: the dart that
 * closes the last objective ends the run.
 */
export function createMarksCloseValidator(
  label: string,
  configSchema: ThreeDartValidatorOptions["configSchema"],
): RulesetValidator {
  const base = createThreeDartValidator({
    label,
    configSchema,
    dartlessIssue: (clientKey) =>
      `turn ${clientKey} must carry dart rows (${DETAILED_DARTS_MODES} or ${VISUAL_BOARD_MODES})`,
  });
  return {
    ...base,
    validateBatch(input) {
      return (
        rejectMarksCloseTurn(label, input.batch) ?? base.validateBatch(input)
      );
    },
  };
}
