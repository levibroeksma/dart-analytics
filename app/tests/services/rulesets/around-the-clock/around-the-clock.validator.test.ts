import { describe, it, expect } from "vitest";
import { aroundTheClockValidator } from "@services/rulesets/around-the-clock/around-the-clock.validator";
import type { DartFactInput } from "@routes/types";

const validConfig = {};

const hitDart: DartFactInput = {
  sequence: 1,
  intendedTargetNumber: null,
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

describe("aroundTheClockValidator.validateConfig", () => {
  it("accepts RECREATIONAL + DETAILED_DARTS with the empty config", () => {
    const result = aroundTheClockValidator.validateConfig({
      config: validConfig,
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a capture/input mode combination the ruleset does not support", () => {
    const result = aroundTheClockValidator.validateConfig({
      config: validConfig,
      captureModeKey: "ANALYTICS",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a config carrying an unrecognized key (the schema is .strict())", () => {
    const result = aroundTheClockValidator.validateConfig({
      config: { direction: "HIGH_TO_LOW" },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });
});

describe("aroundTheClockValidator.validateBatch", () => {
  it("accepts turns carrying dart rows with non-negative scores", () => {
    const result = aroundTheClockValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([[hitDart]]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(true);
  });

  it("accepts a 1-dart turn (a visit that closed early on a BULL hit)", () => {
    const result = aroundTheClockValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([
        [
          {
            ...hitDart,
            hitTargetNumber: 25,
            hitZoneKey: "OUTER_BULL",
            score: 25,
          },
        ],
      ]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a turn with no dart rows under DETAILED_DARTS capture", () => {
    const result = aroundTheClockValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([[]]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a dart with a negative score", () => {
    const result = aroundTheClockValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([[{ ...hitDart, score: -1 }]]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(false);
  });
});

describe("aroundTheClockValidator.validateConfig — visual board", () => {
  it("accepts ANALYTICS + VISUAL_BOARD with the empty config", () => {
    const result = aroundTheClockValidator.validateConfig({
      config: validConfig,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(true);
  });
});

describe("aroundTheClockValidator.validateBatch — visual board", () => {
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
              totalScore: 25,
              completedAt: "2026-08-15T12:00:00.000Z",
              darts: [
                {
                  sequence: 1,
                  intendedTargetNumber: null,
                  intendedZoneKey: null,
                  hitTargetNumber: 25,
                  hitZoneKey: "OUTER_BULL",
                  score: 25,
                  locationX: 0,
                  locationY: -12,
                },
              ],
            },
          ],
        },
      ],
    };

    const result = aroundTheClockValidator.validateBatch({
      config: validConfig,
      batch: batch as never,
      existingTurnCount: 0,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });

    expect(result.valid).toBe(true);
  });

  it("rejects a dartless turn under VISUAL_BOARD capture", () => {
    const result = aroundTheClockValidator.validateBatch({
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

    const result = aroundTheClockValidator.validateBatch({
      config: validConfig,
      batch: batch as never,
      existingTurnCount: 0,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });

    expect(result.valid).toBe(false);
  });
});
