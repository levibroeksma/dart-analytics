import { describe, it, expect } from "vitest";
import { tuodValidator } from "@services/rulesets/tuod/tuod.validator";
import type { DartFactInput } from "@routes/sessions/types";

const validConfig = {
  starting_target: 41,
  finish_bonus: 10,
  miss_penalty: 1,
  duration_type: "ROUNDS",
  duration_value: 10,
  max_darts_per_turn: 3,
};

const minutesConfig = { ...validConfig, duration_type: "MINUTES" };

function batchWithTurns(totalScores: number[]) {
  return {
    stages: [
      {
        clientKey: "block-1",
        stageTypeKey: "EXERCISE_BLOCK",
        parentClientKey: null,
        sequence: 1,
        turns: totalScores.map((totalScore, i) => ({
          clientKey: `t${i + 1}`,
          participantRef: "p1",
          sequence: i + 1,
          totalScore,
          completedAt: "2026-07-26T10:00:00.000Z",
          darts: [] as DartFactInput[],
        })),
      },
    ],
  };
}

describe("tuodValidator.validateConfig", () => {
  it("accepts RECREATIONAL + QUICK_SCORE with a valid config", () => {
    const result = tuodValidator.validateConfig({
      config: validConfig,
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a capture/input mode combination the ruleset does not support", () => {
    const result = tuodValidator.validateConfig({
      config: validConfig,
      captureModeKey: "ANALYTICS",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a starting target below the double-out finishable minimum", () => {
    const result = tuodValidator.validateConfig({
      config: { ...validConfig, starting_target: 1 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a config carrying a key the schema does not model", () => {
    const result = tuodValidator.validateConfig({
      config: { ...validConfig, ladder_floor: 41 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(false);
  });
});

describe("tuodValidator.validateBatch", () => {
  it("accepts a failed attempt scored 0 and a checkout scored at its target", () => {
    const result = tuodValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([41, 0, 51]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(true);
  });

  it("accepts the highest target a ROUNDS ladder can present", () => {
    const result = tuodValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([131]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a total above the ROUNDS ladder ceiling", () => {
    const result = tuodValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([132]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(false);
  });

  it("caps an unbounded MINUTES ladder at the highest three-dart checkout", () => {
    expect(
      tuodValidator.validateBatch({
        config: minutesConfig,
        batch: batchWithTurns([170]),
        existingTurnCount: 0,
      }).valid,
    ).toBe(true);
    expect(
      tuodValidator.validateBatch({
        config: minutesConfig,
        batch: batchWithTurns([171]),
        existingTurnCount: 0,
      }).valid,
    ).toBe(false);
  });

  it("rejects a batch pushing a ROUNDS session past its attempt count", () => {
    const result = tuodValidator.validateBatch({
      config: { ...validConfig, duration_value: 2 },
      batch: batchWithTurns([0, 0]),
      existingTurnCount: 1,
    });
    expect(result.valid).toBe(false);
  });

  it("does not cap the attempt count of a MINUTES session", () => {
    const result = tuodValidator.validateBatch({
      config: { ...minutesConfig, duration_value: 2 },
      batch: batchWithTurns([0, 0]),
      existingTurnCount: 5,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a negative turn total", () => {
    const result = tuodValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([-1]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects dart rows under QUICK_SCORE capture", () => {
    const batch = batchWithTurns([41]);
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
    const result = tuodValidator.validateBatch({
      config: validConfig,
      batch,
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(false);
  });
});
