import { describe, it, expect } from "vitest";
import { bobs27Validator } from "@services/rulesets/bobs27/bobs27.validator";
import type { DartFactInput } from "@routes/sessions/types";

const validConfig = {
  start_score: 27,
  bull_hit_value: 50,
  miss_penalty_multiplier: 1,
};

const hitDart: DartFactInput = {
  sequence: 1,
  intendedTargetNumber: 1,
  intendedZoneKey: "DOUBLE",
  hitTargetNumber: 1,
  hitZoneKey: "DOUBLE",
  score: 2,
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

describe("bobs27Validator.validateConfig", () => {
  it("accepts RECREATIONAL + DETAILED_DARTS with a valid config", () => {
    const result = bobs27Validator.validateConfig({
      config: validConfig,
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a capture/input mode combination the ruleset does not support", () => {
    const result = bobs27Validator.validateConfig({
      config: validConfig,
      captureModeKey: "ANALYTICS",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects an invalid config shape", () => {
    const result = bobs27Validator.validateConfig({
      config: { ...validConfig, start_score: "twenty-seven" },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });
});

describe("bobs27Validator.validateBatch", () => {
  it("accepts turns carrying dart rows with non-negative scores", () => {
    const result = bobs27Validator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([[hitDart]]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a turn with no dart rows under DETAILED_DARTS capture", () => {
    const result = bobs27Validator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([[]]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a dart with a negative score", () => {
    const result = bobs27Validator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([[{ ...hitDart, score: -1 }]]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(false);
  });
});
