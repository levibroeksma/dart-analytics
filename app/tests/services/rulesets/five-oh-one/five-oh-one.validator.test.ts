import { describe, it, expect } from "vitest";
import { fiveOhOneValidator } from "@services/rulesets/five-oh-one/five-oh-one.validator";
import type { DartFactInput } from "@routes/types";

const validConfig = {
  starting_score: 501,
  legs_to_win: 1,
  check_in: "STRAIGHT_IN",
  check_out: "DOUBLE_OUT",
  max_darts_per_turn: 3,
  max_visit_score: 180,
};

function batchWithTurns(totalScores: number[]) {
  return {
    stages: [
      {
        clientKey: "leg-1",
        stageTypeKey: "LEG",
        parentClientKey: null,
        sequence: 1,
        turns: totalScores.map((totalScore, i) => ({
          clientKey: `t${i + 1}`,
          participantRef: "p1",
          sequence: i + 1,
          totalScore,
          completedAt: "2026-07-25T10:00:00.000Z",
          darts: [] as DartFactInput[],
        })),
      },
    ],
  };
}

describe("fiveOhOneValidator.validateConfig", () => {
  it("accepts RECREATIONAL + QUICK_SCORE with a valid config", () => {
    const result = fiveOhOneValidator.validateConfig({
      config: validConfig,
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a capture/input mode combination the ruleset does not support", () => {
    const result = fiveOhOneValidator.validateConfig({
      config: validConfig,
      captureModeKey: "ANALYTICS",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a starting_score below the double-out finishable minimum", () => {
    const result = fiveOhOneValidator.validateConfig({
      config: { ...validConfig, starting_score: 0 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(false);
  });
});

describe("fiveOhOneValidator.validateBatch", () => {
  it("rejects a turn total above the ruleset cap", () => {
    const result = fiveOhOneValidator.validateBatch({
      config: validConfig,
      batch: {
        stages: [
          {
            clientKey: "leg-1",
            stageTypeKey: "LEG",
            parentClientKey: null,
            sequence: 1,
            turns: [
              {
                clientKey: "t1",
                participantRef: "p1",
                sequence: 1,
                totalScore: 181,
                completedAt: "2026-07-25T10:00:00.000Z",
                darts: [],
              },
            ],
          },
        ],
      },
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(false);
  });

  it("accepts turns with no dart rows and scores in range", () => {
    const result = fiveOhOneValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([45, 60]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects dart rows under QUICK_SCORE capture", () => {
    const batch = batchWithTurns([45]);
    batch.stages[0].turns[0].darts = [
      {
        sequence: 1,
        intendedTargetNumber: null,
        intendedZoneKey: null,
        hitTargetNumber: 20,
        hitZoneKey: "SINGLE",
        score: 20,
        locationX: null,
        locationY: null,
      },
    ];
    const result = fiveOhOneValidator.validateBatch({
      config: validConfig,
      batch,
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(false);
  });
});
