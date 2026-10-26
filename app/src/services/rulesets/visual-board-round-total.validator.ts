import type { RulesetValidator } from "@services/interfaces";
import type { BatchValidationResult } from "@services/types";
import type { EventsBatchRequestInput } from "@routes/types";
import type { RoundTotalRule } from "@services/types";
import { isVisualBoardCapture } from "./visual-board.validator";

type BatchTurn = EventsBatchRequestInput["stages"][number]["turns"][number];

function boardSum(turn: BatchTurn): number {
  return turn.darts.reduce((sum, dart) => sum + dart.score, 0);
}

/** The board score of every dart that landed on `target`. */
export function scoreOnNumber(turn: BatchTurn, target: number): number {
  return turn.darts
    .filter((dart) => dart.hitTargetNumber === target)
    .reduce((sum, dart) => sum + dart.score, 0);
}

function rejectWrongTotal(
  args: Parameters<RulesetValidator["validateBatch"]>[0],
  rule: RoundTotalRule,
): BatchValidationResult | null {
  const thrown = new Map<string, number>();
  const turns = args.batch.stages
    .flatMap((stage) => stage.turns)
    .sort((a, b) => a.sequence - b.sequence);
  for (const turn of turns) {
    const round =
      (thrown.get(turn.participantRef) ??
        args.existingTurnCounts[turn.participantRef] ??
        0) + 1;
    thrown.set(turn.participantRef, round);
    const issue = rule(turn, round, args.config);
    if (issue) {
      return {
        valid: false,
        code: "VALIDATION_FAILED",
        issues: [
          `turn ${turn.clientKey} totalScore ${turn.totalScore} ${issue}`,
        ],
      };
    }
  }
  return null;
}

/**
 * A game whose closed visit persists its round points (`closedVisitTotal`),
 * not the board sum the shared visual-board check compares `totalScore` to.
 * The shared check runs on a batch whose totals are board sums; `rule` then
 * judges the real totals.
 */
export function withRoundTotals(
  base: RulesetValidator,
  rule: RoundTotalRule,
): RulesetValidator {
  return {
    ...base,
    validateBatch(args) {
      if (
        !isVisualBoardCapture(
          args.captureModeKey ?? "",
          args.inputModeKey ?? "",
        )
      ) {
        return base.validateBatch(args);
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
      const shared = base.validateBatch({ ...args, batch: asBoardSums });
      if (!shared.valid) return shared;
      return rejectWrongTotal(args, rule) ?? { valid: true };
    },
  };
}
