import { FollowTheLeaderConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import type { EventsBatchRequestInput } from "@routes/types";
import type { BatchValidationResult } from "@services/types";
import { createThreeDartValidator } from "../three-dart.validator";

const threeDartValidator = createThreeDartValidator({
  label: "Follow the Leader",
  configSchema: FollowTheLeaderConfig,
  dartlessIssue: (clientKey) =>
    `turn ${clientKey} must carry dart rows — a Follow the Leader visit is up to 3 darts unless it is a keep`,
});

/** The first kept turn that carries darts or a non-zero total, as a rejection, or null. */
function rejectMalformedKeep(
  batch: EventsBatchRequestInput,
): BatchValidationResult | null {
  for (const stage of batch.stages) {
    const bad = stage.turns.find(
      (turn) => turn.kept && (turn.darts.length > 0 || turn.totalScore !== 0),
    );
    if (bad) {
      return {
        valid: false,
        code: "VALIDATION_FAILED",
        issues: [
          `turn ${bad.clientKey} is a keep and must carry no darts and a total of 0`,
        ],
      };
    }
  }
  return null;
}

/** The batch with its kept turns left out, so the three-dart rules judge only thrown visits. */
function withoutKeeps(batch: EventsBatchRequestInput): EventsBatchRequestInput {
  return {
    ...batch,
    stages: batch.stages.map((stage) => ({
      ...stage,
      turns: stage.turns.filter((turn) => !turn.kept),
    })),
  };
}

/**
 * Follow the Leader: the shared three-dart rules, plus a keep — a dartless
 * turn marked `kept` with a total of 0 — which is the only dartless turn
 * allowed. Seat count is the session's seat floor and cap, not config.
 */
export const followTheLeaderValidator: RulesetValidator = {
  ...threeDartValidator,
  validateBatch(input) {
    const keepRejection = rejectMalformedKeep(input.batch);
    if (keepRejection) return keepRejection;
    return threeDartValidator.validateBatch({
      ...input,
      batch: withoutKeeps(input.batch),
    });
  },
};
