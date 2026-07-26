import { describe, it, expect } from "vitest";
import { scoreTrainingValidator } from "@services/rulesets/score-training/score-training.validator";
import type { DartFactInput } from "@routes/types";

const validConfig = {
  duration_type: "ROUNDS",
  duration_value: 10,
  max_darts_per_turn: 3,
};

describe("scoreTrainingValidator.validateConfig", () => {
  it("accepts RECREATIONAL + QUICK_SCORE with a valid config", () => {
    const result = scoreTrainingValidator.validateConfig({
      config: validConfig,
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects ANALYTICS capture mode", () => {
    const result = scoreTrainingValidator.validateConfig({
      config: validConfig,
      captureModeKey: "ANALYTICS",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects an invalid config shape", () => {
    const result = scoreTrainingValidator.validateConfig({
      config: {
        duration_type: "ROUNDS",
        duration_value: 10,
        max_darts_per_turn: 4,
      },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(false);
  });

  it("accepts duration_value: 50, the ROUNDS ceiling", () => {
    const result = scoreTrainingValidator.validateConfig({
      config: {
        duration_type: "ROUNDS",
        duration_value: 50,
        max_darts_per_turn: 3,
      },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects duration_value: 51, one past the ROUNDS ceiling", () => {
    const result = scoreTrainingValidator.validateConfig({
      config: {
        duration_type: "ROUNDS",
        duration_value: 51,
        max_darts_per_turn: 3,
      },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(false);
  });

  it("accepts duration_value: 180, the MINUTES ceiling", () => {
    const result = scoreTrainingValidator.validateConfig({
      config: {
        duration_type: "MINUTES",
        duration_value: 180,
        max_darts_per_turn: 3,
      },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects duration_value: 181, one past the MINUTES ceiling", () => {
    const result = scoreTrainingValidator.validateConfig({
      config: {
        duration_type: "MINUTES",
        duration_value: 181,
        max_darts_per_turn: 3,
      },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a config carrying a key the shared schema does not model", () => {
    const result = scoreTrainingValidator.validateConfig({
      config: { ...validConfig, unknown_key: "drift" },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(false);
  });
});

describe("scoreTrainingValidator.validateBatch", () => {
  const config = {
    duration_type: "ROUNDS",
    duration_value: 2,
    max_darts_per_turn: 3,
  };

  function batchWithTurns(totalScores: number[]) {
    return {
      stages: [
        {
          clientKey: "s1",
          stageTypeKey: "EXERCISE_BLOCK",
          parentClientKey: null,
          sequence: 1,
          turns: totalScores.map((totalScore, i) => ({
            clientKey: `t${i + 1}`,
            participantRef: "p1",
            sequence: i + 1,
            totalScore,
            completedAt: null,
            darts: [] as DartFactInput[],
          })),
        },
      ],
    };
  }

  it("accepts turns with no dart rows and scores in range", () => {
    const result = scoreTrainingValidator.validateBatch({
      config,
      batch: batchWithTurns([45, 60]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a turn carrying dart rows", () => {
    const batch = batchWithTurns([45]);
    batch.stages[0].turns[0].darts = [
      {
        sequence: 1,
        intendedTargetNumber: null,
        intendedZoneKey: null,
        hitTargetNumber: 20,
        hitZoneKey: "SINGLE",
        score: 20,
      },
    ];
    const result = scoreTrainingValidator.validateBatch({
      config,
      batch,
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a totalScore above 180", () => {
    const result = scoreTrainingValidator.validateBatch({
      config,
      batch: batchWithTurns([181]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects exceeding the ROUNDS ceiling across existing + new turns", () => {
    const result = scoreTrainingValidator.validateBatch({
      config,
      batch: batchWithTurns([45]),
      existingTurnCount: 2,
    });
    expect(result.valid).toBe(false);
  });

  it("does not cap turn count for MINUTES", () => {
    const result = scoreTrainingValidator.validateBatch({
      config: {
        duration_type: "MINUTES",
        duration_value: 15,
        max_darts_per_turn: 3,
      },
      batch: batchWithTurns([45]),
      existingTurnCount: 999,
    });
    expect(result.valid).toBe(true);
  });
});
