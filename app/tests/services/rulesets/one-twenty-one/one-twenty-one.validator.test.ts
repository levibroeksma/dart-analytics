import { describe, it, expect } from "vitest";
import { oneTwentyOneValidator } from "@services/rulesets/one-twenty-one/one-twenty-one.validator";
import type { DartFactInput } from "@routes/types";

function batchWithTurns(totalScores: number[]) {
  return {
    stages: [
      {
        clientKey: "round-1",
        stageTypeKey: "ROUND",
        parentClientKey: null,
        sequence: 1,
        turns: totalScores.map((totalScore, i) => ({
          clientKey: `t${i + 1}`,
          participantRef: "p1",
          sequence: i + 1,
          totalScore,
          completedAt: "2026-08-14T10:00:00.000Z",
          darts: [] as DartFactInput[],
        })),
      },
    ],
  };
}

describe("oneTwentyOneValidator.validateConfig", () => {
  it("accepts RECREATIONAL + QUICK_SCORE with the empty config", () => {
    const result = oneTwentyOneValidator.validateConfig({
      config: {},
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a capture/input mode combination the ruleset does not support", () => {
    const result = oneTwentyOneValidator.validateConfig({
      config: {},
      captureModeKey: "ANALYTICS",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a config carrying a key the schema does not model", () => {
    const result = oneTwentyOneValidator.validateConfig({
      config: { starting_target: 121 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(false);
  });
});

describe("oneTwentyOneValidator.validateBatch", () => {
  it("accepts a failed visit scored 0 and a checkout scored at its target", () => {
    const result = oneTwentyOneValidator.validateBatch({
      config: {},
      batch: batchWithTurns([0, 0, 121]),
      existingTurnCounts: {},
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(true);
  });

  it("accepts the highest possible 3-dart visit (180)", () => {
    const result = oneTwentyOneValidator.validateBatch({
      config: {},
      batch: batchWithTurns([180]),
      existingTurnCounts: {},
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a total above 180", () => {
    const result = oneTwentyOneValidator.validateBatch({
      config: {},
      batch: batchWithTurns([181]),
      existingTurnCounts: {},
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a negative turn total", () => {
    const result = oneTwentyOneValidator.validateBatch({
      config: {},
      batch: batchWithTurns([-1]),
      existingTurnCounts: {},
    });
    expect(result.valid).toBe(false);
  });

  it("rejects dart rows under QUICK_SCORE capture", () => {
    const batch = batchWithTurns([60]);
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
    const result = oneTwentyOneValidator.validateBatch({
      config: {},
      batch,
      existingTurnCounts: {},
    });
    expect(result.valid).toBe(false);
  });
});

describe("oneTwentyOneValidator.validateConfig — visual board", () => {
  it("accepts ANALYTICS + VISUAL_BOARD with the empty config", () => {
    const result = oneTwentyOneValidator.validateConfig({
      config: {},
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(true);
  });
});

describe("oneTwentyOneValidator.validateBatch — visual board", () => {
  it("validates a visual-board batch through the coordinate validator", () => {
    const batch = {
      stages: [
        {
          clientKey: "round-1",
          stageTypeKey: "ROUND",
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

    const result = oneTwentyOneValidator.validateBatch({
      config: {},
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

    const result = oneTwentyOneValidator.validateBatch({
      config: {},
      batch,
      existingTurnCounts: {},
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });

    expect(result.valid).toBe(false);
  });
});
