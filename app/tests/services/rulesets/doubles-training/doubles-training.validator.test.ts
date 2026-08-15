import { describe, it, expect } from "vitest";
import { doublesTrainingValidator } from "@services/rulesets/doubles-training/doubles-training.validator";
import type { DartFactInput } from "@routes/types";

const validConfig = {
  mode: "EASY",
  order_mode: "LOW_TO_HIGH",
  target_order: [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
  ],
};

const hitDart: DartFactInput = {
  sequence: 1,
  intendedTargetNumber: 1,
  intendedZoneKey: "DOUBLE",
  hitTargetNumber: 1,
  hitZoneKey: "DOUBLE",
  score: 2,
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

describe("doublesTrainingValidator.validateConfig", () => {
  it("accepts RECREATIONAL + DETAILED_DARTS with a valid config", () => {
    const result = doublesTrainingValidator.validateConfig({
      config: validConfig,
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a capture/input mode combination the ruleset does not support", () => {
    const result = doublesTrainingValidator.validateConfig({
      config: validConfig,
      captureModeKey: "ANALYTICS",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects an invalid config shape", () => {
    const result = doublesTrainingValidator.validateConfig({
      config: { ...validConfig, mode: "HARD" },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });
});

describe("doublesTrainingValidator.validateBatch", () => {
  it("accepts turns carrying dart rows with non-negative scores", () => {
    const result = doublesTrainingValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([[hitDart]]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a turn with no dart rows under DETAILED_DARTS capture", () => {
    const result = doublesTrainingValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([[]]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a dart with a negative score", () => {
    const result = doublesTrainingValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([[{ ...hitDart, score: -1 }]]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(false);
  });
});

describe("doublesTrainingValidator.validateConfig — visual board", () => {
  it("accepts ANALYTICS + VISUAL_BOARD with a valid config", () => {
    const result = doublesTrainingValidator.validateConfig({
      config: validConfig,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(true);
  });
});

describe("doublesTrainingValidator.validateBatch — visual board", () => {
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
                  intendedTargetNumber: 20,
                  intendedZoneKey: "DOUBLE",
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

    const result = doublesTrainingValidator.validateBatch({
      config: validConfig,
      batch: batch as never,
      existingTurnCount: 0,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });

    expect(result.valid).toBe(true);
  });

  it("rejects a dartless turn under VISUAL_BOARD capture", () => {
    const result = doublesTrainingValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([[]]),
      existingTurnCount: 0,
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
                  intendedTargetNumber: 20,
                  intendedZoneKey: "DOUBLE",
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

    const result = doublesTrainingValidator.validateBatch({
      config: validConfig,
      batch: batch as never,
      existingTurnCount: 0,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });

    expect(result.valid).toBe(false);
  });
});
