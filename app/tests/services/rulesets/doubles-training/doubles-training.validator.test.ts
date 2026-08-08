import { describe, it, expect } from "vitest";
import { doublesTrainingValidator } from "@services/rulesets/doubles-training/doubles-training.validator";
import type { DartFactInput } from "@routes/types";

const validConfig = {
  mode: "EASY",
  order_mode: "LOW_TO_HIGH",
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
