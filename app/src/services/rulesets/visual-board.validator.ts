import { classify } from "@lib/game/board/board-geometry.module";
import type { EventsBatchRequestInput } from "@routes/types";
import type { BatchValidationResult } from "./types";

const VISUAL_BOARD_CAPTURE_MODE = "ANALYTICS";
const VISUAL_BOARD_INPUT_MODE = "VISUAL_BOARD";

/** The mode pair every coordinate-capturing ruleset names in its rejection message. */
export const VISUAL_BOARD_MODES = `${VISUAL_BOARD_CAPTURE_MODE} + ${VISUAL_BOARD_INPUT_MODE}`;

/** Whether a session captures individual darts with a landing coordinate. */
export function isVisualBoardCapture(
  captureModeKey: string,
  inputModeKey: string,
): boolean {
  return (
    captureModeKey === VISUAL_BOARD_CAPTURE_MODE &&
    inputModeKey === VISUAL_BOARD_INPUT_MODE
  );
}

function reject(issue: string): BatchValidationResult {
  return { valid: false, code: "VALIDATION_FAILED", issues: [issue] };
}

/**
 * Re-derives every submitted dart from its own coordinate and refuses the
 * batch when the client's claim disagrees. The client computes the board fact
 * for immediate feedback, but it is never trusted as the authority — a stale
 * or tampered client would otherwise write permanent, silently wrong rows into
 * the analytical dataset.
 *
 * A dart with no coordinate is an unseen throw (bounce-out): it must score
 * nothing and name no target. A turn total of 0 against scoring darts is a
 * bust and is accepted; any other disagreement between the total and the sum
 * of its darts is refused.
 */
export function validateVisualBoardTurns(
  batch: EventsBatchRequestInput,
): BatchValidationResult {
  for (const stage of batch.stages) {
    for (const turn of stage.turns) {
      let countedTotal = 0;

      for (const dart of turn.darts) {
        if (dart.locationX === null || dart.locationY === null) {
          if (dart.score !== 0 || dart.hitTargetNumber !== null) {
            return reject(
              `dart ${dart.sequence} in turn ${turn.clientKey} has no location, so it must score 0 and name no target (${VISUAL_BOARD_MODES})`,
            );
          }
          continue;
        }

        const resolved = classify(dart.locationX, dart.locationY);

        if (dart.hitZoneKey !== resolved.zoneKey) {
          return reject(
            `dart ${dart.sequence} in turn ${turn.clientKey} claims zone ${dart.hitZoneKey}, but its location resolves to ${resolved.zoneKey}`,
          );
        }
        if (dart.hitTargetNumber !== resolved.targetNumber) {
          return reject(
            `dart ${dart.sequence} in turn ${turn.clientKey} claims target ${dart.hitTargetNumber}, but its location resolves to ${resolved.targetNumber}`,
          );
        }
        if (dart.score !== resolved.score) {
          return reject(
            `dart ${dart.sequence} in turn ${turn.clientKey} claims score ${dart.score}, but its location resolves to ${resolved.score}`,
          );
        }

        countedTotal += resolved.score;
      }

      if (turn.totalScore !== countedTotal && turn.totalScore !== 0) {
        return reject(
          `turn ${turn.clientKey} totalScore ${turn.totalScore} is neither the sum of its darts (${countedTotal}) nor 0 for a void visit`,
        );
      }
    }
  }

  return { valid: true };
}
