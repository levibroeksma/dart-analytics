import { describe, it, expect } from "vitest";
import { exceedsRoundsLimit } from "@services/rulesets/quick-score.validator";
import type { DartFactInput, EventsBatchRequestInput } from "@routes/types";

function batchWithTurns(
  turns: Array<{ participantRef: string; totalScore: number }>,
): EventsBatchRequestInput {
  return {
    stages: [
      {
        clientKey: "s1",
        stageTypeKey: "EXERCISE_BLOCK",
        parentClientKey: null,
        sequence: 1,
        turns: turns.map((turn, i) => ({
          clientKey: `t${i + 1}`,
          participantRef: turn.participantRef,
          sequence: i + 1,
          totalScore: turn.totalScore,
          completedAt: null,
          darts: [] as DartFactInput[],
        })),
      },
    ],
  };
}

describe("exceedsRoundsLimit", () => {
  it("never rejects a non-ROUNDS session", () => {
    const result = exceedsRoundsLimit(
      { duration_type: "MINUTES", duration_value: 1 },
      batchWithTurns([{ participantRef: "p1", totalScore: 45 }]),
      { p1: 999 },
    );
    expect(result).toBe(false);
  });

  it("rejects when a solo seat's existing + batch turns exceed duration_value", () => {
    const result = exceedsRoundsLimit(
      { duration_type: "ROUNDS", duration_value: 2 },
      batchWithTurns([{ participantRef: "p1", totalScore: 45 }]),
      { p1: 2 },
    );
    expect(result).toBe(true);
  });

  it("accepts a 1v1 batch where each seat is under its own budget, even though the combined total is over it", () => {
    const result = exceedsRoundsLimit(
      { duration_type: "ROUNDS", duration_value: 2 },
      batchWithTurns([{ participantRef: "p2", totalScore: 45 }]),
      { p1: 2, p2: 1 },
    );
    expect(result).toBe(false);
  });

  it("rejects a 1v1 batch when one seat's own turn count would exceed the budget", () => {
    const result = exceedsRoundsLimit(
      { duration_type: "ROUNDS", duration_value: 2 },
      batchWithTurns([{ participantRef: "p2", totalScore: 45 }]),
      { p1: 2, p2: 2 },
    );
    expect(result).toBe(true);
  });

  it("treats a participant absent from existingTurnCounts as zero existing turns", () => {
    const result = exceedsRoundsLimit(
      { duration_type: "ROUNDS", duration_value: 1 },
      batchWithTurns([{ participantRef: "p1", totalScore: 45 }]),
      {},
    );
    expect(result).toBe(false);
  });
});
