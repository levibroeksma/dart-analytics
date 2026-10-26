import { describe, it, expect } from "vitest";
import {
  scoreOnNumber,
  withRoundTotals,
} from "@services/rulesets/visual-board-round-total.validator";
import type { RulesetValidator } from "@services/interfaces";
import type { DartFactInput } from "@routes/types";

const dart = (hitTargetNumber: number, score: number): DartFactInput => ({
  sequence: 1,
  intendedTargetNumber: null,
  intendedZoneKey: null,
  hitTargetNumber,
  hitZoneKey: "SINGLE",
  score,
  locationX: null,
  locationY: null,
});

function batch(totals: number[], darts: DartFactInput[]) {
  return {
    stages: [
      {
        clientKey: "s",
        stageTypeKey: "EXERCISE_BLOCK",
        parentClientKey: null,
        sequence: 1,
        turns: totals.map((totalScore, i) => ({
          clientKey: `t${i + 1}`,
          participantRef: "p1",
          sequence: i + 1,
          totalScore,
          completedAt: null,
          darts,
        })),
      },
    ],
  };
}

describe("scoreOnNumber", () => {
  it("sums only darts on the number", () => {
    const turn = batch([0], [dart(3, 3), dart(5, 5), dart(3, 6)]).stages[0]
      .turns[0];
    expect(scoreOnNumber(turn, 3)).toBe(9);
  });
});

describe("withRoundTotals", () => {
  const seen: number[][] = [];
  const base = {
    validateConfig: () => ({ valid: true, config: {} }),
    validateBatch: ({ batch: b }) => {
      seen.push(b.stages[0].turns.map((t) => t.totalScore));
      return { valid: true };
    },
  } as RulesetValidator;
  const rule = (turn: { totalScore: number }, round: number) =>
    turn.totalScore === round ? null : `is not ${round}`;
  const validator = withRoundTotals(base, rule);
  const visual = { captureModeKey: "ANALYTICS", inputModeKey: "VISUAL_BOARD" };

  it("hands the base a board-sum batch and judges the real totals by round", () => {
    const darts = [dart(1, 2), dart(2, 4)];
    const ok = validator.validateBatch({
      config: {},
      batch: batch([1, 2], darts),
      existingTurnCounts: {},
      ...visual,
    });
    expect(ok.valid).toBe(true);
    expect(seen.at(-1)).toEqual([6, 6]);
    const bad = validator.validateBatch({
      config: {},
      batch: batch([1, 1], darts),
      existingTurnCounts: {},
      ...visual,
    });
    expect(bad.valid).toBe(false);
  });

  it("counts rounds from the stored turns", () => {
    const result = validator.validateBatch({
      config: {},
      batch: batch([3], [dart(1, 1)]),
      existingTurnCounts: { p1: 2 },
      ...visual,
    });
    expect(result.valid).toBe(true);
  });

  it("defers to the base outside visual-board capture", () => {
    const result = validator.validateBatch({
      config: {},
      batch: batch([99], [dart(1, 1)]),
      existingTurnCounts: {},
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(true);
    expect(seen.at(-1)).toEqual([99]);
  });
});
