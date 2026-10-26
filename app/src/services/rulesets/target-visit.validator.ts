import type { EventsBatchRequestInput } from "@routes/types";

type BatchTurn = EventsBatchRequestInput["stages"][number]["turns"][number];

function boardSum(turn: BatchTurn): number {
  return turn.darts.reduce((sum, dart) => sum + dart.score, 0);
}

/** The board score of every dart in `turn` that landed on `target`. */
export function runsIn(turn: BatchTurn, target: number): number {
  return turn.darts
    .filter((dart) => dart.hitTargetNumber === target)
    .reduce((sum, dart) => sum + dart.score, 0);
}

/**
 * The batch with each turn's `totalScore` replaced by its board sum, so the
 * shared visual-board check can verify the darts alone for a ruleset whose
 * visit total is a game score rather than a board sum.
 */
export function withBoardSumTotals(
  batch: EventsBatchRequestInput,
): EventsBatchRequestInput {
  return {
    ...batch,
    stages: batch.stages.map((stage) => ({
      ...stage,
      turns: stage.turns.map((turn) => ({
        ...turn,
        totalScore: boardSum(turn),
      })),
    })),
  };
}
