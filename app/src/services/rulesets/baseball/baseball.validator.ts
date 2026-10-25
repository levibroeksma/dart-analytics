import { BaseballConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import type { BatchValidationResult } from "@services/types";
import type { EventsBatchRequestInput } from "@routes/types";
import { createThreeDartValidator } from "../three-dart.validator";
import { isVisualBoardCapture } from "../visual-board.validator";

type BatchTurn = EventsBatchRequestInput["stages"][number]["turns"][number];

const threeDartValidator = createThreeDartValidator({
  label: "Baseball Darts",
  configSchema: BaseballConfig,
  dartlessIssue: (clientKey) =>
    `turn ${clientKey} must carry dart rows — every Baseball Darts inning is exactly 3 darts, hit or miss, never a dartless total`,
});

function boardSum(turn: BatchTurn): number {
  return turn.darts.reduce((sum, dart) => sum + dart.score, 0);
}

/** The runs a turn scored in `inning`: the board score of every dart that landed on the inning's own number. */
function runsIn(turn: BatchTurn, inning: number): number {
  return turn.darts
    .filter((dart) => dart.hitTargetNumber === inning)
    .reduce((sum, dart) => sum + dart.score, 0);
}

/**
 * A closed Baseball inning's `totalScore` is its runs, not the board sum the
 * shared visual-board check compares it to. Rejects a turn whose total is
 * neither its runs nor 0 (a void visit); the inning is the participant's
 * stored turn count plus the turns before it in the batch.
 */
function rejectWrongRuns(
  batch: EventsBatchRequestInput,
  existingTurnCounts: Record<string, number>,
): BatchValidationResult | null {
  const thrown = new Map<string, number>();
  const turns = batch.stages
    .flatMap((stage) => stage.turns)
    .sort((a, b) => a.sequence - b.sequence);
  for (const turn of turns) {
    const before =
      thrown.get(turn.participantRef) ??
      existingTurnCounts[turn.participantRef] ??
      0;
    thrown.set(turn.participantRef, before + 1);
    const runs = runsIn(turn, before + 1);
    if (turn.totalScore !== runs && turn.totalScore !== 0) {
      return {
        valid: false,
        code: "VALIDATION_FAILED",
        issues: [
          `turn ${turn.clientKey} totalScore ${turn.totalScore} is neither the runs scored in inning ${before + 1} (${runs}) nor 0 for a void visit`,
        ],
      };
    }
  }
  return null;
}

/**
 * Baseball Darts: the shared three-dart rules, with each turn's runs standing
 * in for the board sum the visual-board check would otherwise demand.
 */
export const baseballValidator: RulesetValidator = {
  ...threeDartValidator,
  validateBatch(args) {
    if (
      !isVisualBoardCapture(args.captureModeKey ?? "", args.inputModeKey ?? "")
    ) {
      return threeDartValidator.validateBatch(args);
    }
    const asBoardSums: EventsBatchRequestInput = {
      ...args.batch,
      stages: args.batch.stages.map((stage) => ({
        ...stage,
        turns: stage.turns.map((turn) => ({
          ...turn,
          totalScore: boardSum(turn),
        })),
      })),
    };
    const shared = threeDartValidator.validateBatch({
      ...args,
      batch: asBoardSums,
    });
    if (!shared.valid) return shared;
    return (
      rejectWrongRuns(args.batch, args.existingTurnCounts) ?? { valid: true }
    );
  },
};
