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

  it("accepts ANALYTICS + VISUAL_BOARD with a valid config", () => {
    const result = scoreTrainingValidator.validateConfig({
      config: validConfig,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a capture/input mode combination the ruleset does not support, naming both supported pairs", () => {
    const result = scoreTrainingValidator.validateConfig({
      config: validConfig,
      captureModeKey: "ANALYTICS",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
    const issues = !result.valid ? String(result.issues) : "";
    expect(issues).toContain("RECREATIONAL + QUICK_SCORE");
    expect(issues).toContain("ANALYTICS + VISUAL_BOARD");
  });

  it("rejects ANALYTICS + VISUAL_BOARD with an invalid config", () => {
    const result = scoreTrainingValidator.validateConfig({
      config: {
        duration_type: "ROUNDS",
        duration_value: 10,
        max_darts_per_turn: 4,
      },
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
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

  it("accepts duration_value: 100, the ROUNDS ceiling", () => {
    const result = scoreTrainingValidator.validateConfig({
      config: {
        duration_type: "ROUNDS",
        duration_value: 100,
        max_darts_per_turn: 3,
      },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects duration_value: 101, one past the ROUNDS ceiling", () => {
    const result = scoreTrainingValidator.validateConfig({
      config: {
        duration_type: "ROUNDS",
        duration_value: 101,
        max_darts_per_turn: 3,
      },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects duration_value: 2, one below the MINUTES floor", () => {
    const result = scoreTrainingValidator.validateConfig({
      config: {
        duration_type: "MINUTES",
        duration_value: 2,
        max_darts_per_turn: 3,
      },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(false);
  });

  it("accepts duration_value: 3, the MINUTES floor", () => {
    const result = scoreTrainingValidator.validateConfig({
      config: {
        duration_type: "MINUTES",
        duration_value: 3,
        max_darts_per_turn: 3,
      },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(true);
  });

  it("accepts duration_value: 30, the MINUTES ceiling", () => {
    const result = scoreTrainingValidator.validateConfig({
      config: {
        duration_type: "MINUTES",
        duration_value: 30,
        max_darts_per_turn: 3,
      },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects duration_value: 31, one past the MINUTES ceiling", () => {
    const result = scoreTrainingValidator.validateConfig({
      config: {
        duration_type: "MINUTES",
        duration_value: 31,
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
      existingTurnCounts: {},
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
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
        locationX: null,
        locationY: null,
      },
    ];
    const result = scoreTrainingValidator.validateBatch({
      config,
      batch,
      existingTurnCounts: {},
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a totalScore above 180", () => {
    const result = scoreTrainingValidator.validateBatch({
      config,
      batch: batchWithTurns([181]),
      existingTurnCounts: {},
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects exceeding the ROUNDS ceiling across existing + new turns", () => {
    const result = scoreTrainingValidator.validateBatch({
      config,
      batch: batchWithTurns([45]),
      existingTurnCounts: { p1: 2 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(false);
  });

  it("accepts a 1v1 batch where each seat is under its own ROUNDS budget, even though the combined total is over it", () => {
    const batch = {
      stages: [
        {
          clientKey: "s1",
          stageTypeKey: "EXERCISE_BLOCK",
          parentClientKey: null,
          sequence: 1,
          turns: [
            {
              clientKey: "t1",
              participantRef: "p2",
              sequence: 1,
              totalScore: 45,
              completedAt: null,
              darts: [] as DartFactInput[],
            },
          ],
        },
      ],
    };
    const result = scoreTrainingValidator.validateBatch({
      config,
      batch,
      existingTurnCounts: { p1: 2, p2: 1 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a 1v1 batch when one seat's own turn count would exceed the ROUNDS budget", () => {
    const batch = {
      stages: [
        {
          clientKey: "s1",
          stageTypeKey: "EXERCISE_BLOCK",
          parentClientKey: null,
          sequence: 1,
          turns: [
            {
              clientKey: "t1",
              participantRef: "p2",
              sequence: 1,
              totalScore: 45,
              completedAt: null,
              darts: [] as DartFactInput[],
            },
          ],
        },
      ],
    };
    const result = scoreTrainingValidator.validateBatch({
      config,
      batch,
      existingTurnCounts: { p1: 2, p2: 2 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
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
      existingTurnCounts: { p1: 999 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(true);
  });

  it("validates a visual-board batch through the coordinate validator", () => {
    const batch = {
      stages: [
        {
          clientKey: "leg-1",
          stageTypeKey: "LEG",
          parentClientKey: null,
          sequence: 1,
          turns: [
            {
              clientKey: "turn-1",
              participantRef: "p1",
              sequence: 1,
              totalScore: 60,
              completedAt: "2026-08-05T12:00:00.000Z",
              darts: [
                {
                  sequence: 1,
                  intendedTargetNumber: null,
                  intendedZoneKey: null,
                  hitTargetNumber: 20,
                  hitZoneKey: "TREBLE",
                  score: 60,
                  locationX: 0,
                  locationY: -102,
                },
              ],
            },
          ],
        },
      ],
    };

    const result = scoreTrainingValidator.validateBatch({
      config,
      batch: batch as never,
      existingTurnCounts: {},
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });

    expect(result.valid).toBe(true);
  });

  it("still rejects dart rows in a quick-score batch", () => {
    const batch = batchWithTurns([60]);
    batch.stages[0].turns[0].darts = [
      {
        sequence: 1,
        intendedTargetNumber: null,
        intendedZoneKey: null,
        hitTargetNumber: 20,
        hitZoneKey: "TREBLE",
        score: 60,
        locationX: null,
        locationY: null,
      },
    ];

    const result = scoreTrainingValidator.validateBatch({
      config,
      batch,
      existingTurnCounts: {},
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });

    expect(result.valid).toBe(false);
  });
});
