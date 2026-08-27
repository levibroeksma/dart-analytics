import { describe, it, expect } from "vitest";
import { singlesTrainingValidator } from "@services/rulesets/singles-training/singles-training.validator";
import type { DartFactInput } from "@routes/types";

const validConfig = {
  order_mode: "LOW_TO_HIGH",
  target_order: [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
  ],
  difficulty: "EASY",
  points_single: 1,
  points_double: 2,
  points_treble: 3,
};

const hitDart: DartFactInput = {
  sequence: 1,
  intendedTargetNumber: 1,
  intendedZoneKey: null,
  hitTargetNumber: 1,
  hitZoneKey: "SINGLE",
  score: 1,
  locationX: null,
  locationY: null,
};

function batchWithTurns(darts: DartFactInput[][]) {
  return {
    stages: [
      {
        clientKey: "block-1",
        stageTypeKey: "EXERCISE_BLOCK",
        parentClientKey: null,
        sequence: 1,
        turns: darts.map((turnDarts, i) => ({
          clientKey: `t${i + 1}`,
          participantRef: "p1",
          sequence: i + 1,
          totalScore: turnDarts.reduce((total, dart) => total + dart.score, 0),
          completedAt: null,
          darts: turnDarts,
        })),
      },
    ],
  };
}

describe("singlesTrainingValidator.validateConfig", () => {
  it("accepts RECREATIONAL + DETAILED_DARTS with a valid config", () => {
    const result = singlesTrainingValidator.validateConfig({
      config: validConfig,
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a capture/input mode combination the ruleset does not support", () => {
    const result = singlesTrainingValidator.validateConfig({
      config: validConfig,
      captureModeKey: "ANALYTICS",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects an invalid config shape", () => {
    const result = singlesTrainingValidator.validateConfig({
      config: { ...validConfig, order_mode: "SIDEWAYS" },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });
});

describe("singlesTrainingValidator.validateBatch", () => {
  it("accepts turns carrying dart rows with non-negative scores", () => {
    const result = singlesTrainingValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([[hitDart]]),
      existingTurnCounts: {},
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a turn with no dart rows under DETAILED_DARTS capture", () => {
    const result = singlesTrainingValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([[]]),
      existingTurnCounts: {},
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a dart with a negative score", () => {
    const result = singlesTrainingValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([[{ ...hitDart, score: -1 }]]),
      existingTurnCounts: {},
    });
    expect(result.valid).toBe(false);
  });
});

describe("singlesTrainingValidator.validateConfig — visual board", () => {
  it("accepts ANALYTICS + VISUAL_BOARD with a valid config", () => {
    const result = singlesTrainingValidator.validateConfig({
      config: validConfig,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(true);
  });
});

describe("singlesTrainingValidator.validateBatch — visual board", () => {
  it("validates a visual-board batch through the coordinate validator", () => {
    const batch = {
      stages: [
        {
          clientKey: "block-1",
          stageTypeKey: "EXERCISE_BLOCK",
          parentClientKey: null,
          sequence: 1,
          turns: [
            {
              clientKey: "turn-1",
              participantRef: "p1",
              sequence: 1,
              totalScore: 60,
              completedAt: "2026-08-15T12:00:00.000Z",
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

    const result = singlesTrainingValidator.validateBatch({
      config: validConfig,
      batch: batch as never,
      existingTurnCounts: {},
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });

    expect(result.valid).toBe(true);
  });

  it("rejects a dartless turn under VISUAL_BOARD capture", () => {
    const result = singlesTrainingValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([[]]),
      existingTurnCounts: {},
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a dart whose claimed zone disagrees with its location", () => {
    const batch = {
      stages: [
        {
          clientKey: "block-1",
          stageTypeKey: "EXERCISE_BLOCK",
          parentClientKey: null,
          sequence: 1,
          turns: [
            {
              clientKey: "turn-1",
              participantRef: "p1",
              sequence: 1,
              totalScore: 20,
              completedAt: "2026-08-15T12:00:00.000Z",
              darts: [
                {
                  sequence: 1,
                  intendedTargetNumber: null,
                  intendedZoneKey: null,
                  hitTargetNumber: 20,
                  hitZoneKey: "SINGLE",
                  score: 20,
                  locationX: 0,
                  locationY: -102,
                },
              ],
            },
          ],
        },
      ],
    };

    const result = singlesTrainingValidator.validateBatch({
      config: validConfig,
      batch: batch as never,
      existingTurnCounts: {},
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });

    expect(result.valid).toBe(false);
  });
});
