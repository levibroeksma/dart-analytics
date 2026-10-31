import { PrisonerConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import type { EventsBatchRequestInput } from "@routes/types";
import type { BatchValidationResult } from "@services/types";
import { createThreeDartValidator } from "../three-dart.validator";
import {
  isVisualBoardCapture,
  VISUAL_BOARD_MODES,
} from "../visual-board.validator";

const MAX_VISIT_DARTS = 6;

const threeDartValidator = createThreeDartValidator({
  label: "Prisoner",
  configSchema: PrisonerConfig,
  dartlessIssue: (clientKey) =>
    `turn ${clientKey} must carry dart rows — a Prisoner visit is the darts the seat can throw`,
});

function reject(issue: string): BatchValidationResult {
  return { valid: false, code: "VALIDATION_FAILED", issues: [issue] };
}

/** The first turn over six darts or dart in the unbanded `SINGLE` zone, as a rejection, or null. */
function rejectPrisonerTurn(
  batch: EventsBatchRequestInput,
): BatchValidationResult | null {
  for (const stage of batch.stages) {
    for (const turn of stage.turns) {
      if (turn.darts.length > MAX_VISIT_DARTS)
        return reject(
          `turn ${turn.clientKey} holds ${turn.darts.length} darts — a Prisoner visit is at most ${MAX_VISIT_DARTS}`,
        );
      const single = turn.darts.find((dart) => dart.hitZoneKey === "SINGLE");
      if (single)
        return reject(
          `dart ${single.sequence} in turn ${turn.clientKey} is an unbanded SINGLE — Prisoner needs the inner or outer single`,
        );
    }
  }
  return null;
}

/**
 * Prisoner: board capture only, since the inner and outer single bands
 * decide every dart; a visit holds at most six darts (two seats can hold
 * six between them), and no dart may carry the keypad's unbanded `SINGLE`.
 * The shared three-dart rules judge the rest. Seat count is the session's
 * seat floor and cap, not config.
 */
export const prisonerValidator: RulesetValidator = {
  validateConfig(input) {
    if (!isVisualBoardCapture(input.captureModeKey, input.inputModeKey))
      return {
        valid: false,
        issues: [`Prisoner V1 only supports ${VISUAL_BOARD_MODES}`],
      };
    return threeDartValidator.validateConfig(input);
  },
  validateBatch(input) {
    return (
      rejectPrisonerTurn(input.batch) ?? threeDartValidator.validateBatch(input)
    );
  },
};
