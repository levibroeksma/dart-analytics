import { describe, it, expect } from "vitest";
import {
  shanghaiValidator,
  shanghaiV2Validator,
} from "@services/rulesets/shanghai/shanghai.validator";
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

describe("shanghaiValidator.validateConfig", () => {
  it("accepts RECREATIONAL + DETAILED_DARTS with the empty config", () => {
    const result = shanghaiValidator.validateConfig({
      config: validConfig,
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a capture/input mode combination the ruleset does not support", () => {
    const result = shanghaiValidator.validateConfig({
      config: validConfig,
      captureModeKey: "ANALYTICS",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a config carrying an unrecognized key (the schema is .strict())", () => {
    const result = shanghaiValidator.validateConfig({
      config: { rounds: 7 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });
});

describe("shanghaiValidator.validateBatch", () => {
  it("accepts turns carrying dart rows with non-negative scores", () => {
    const result = shanghaiValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([[hitDart]]),
      existingTurnCounts: {},
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a turn with no dart rows under DETAILED_DARTS capture", () => {
    const result = shanghaiValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([[]]),
      existingTurnCounts: {},
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a dart with a negative score", () => {
    const result = shanghaiValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([[{ ...hitDart, score: -1 }]]),
      existingTurnCounts: {},
    });
    expect(result.valid).toBe(false);
  });
});

describe("shanghaiValidator.validateConfig — visual board", () => {
  it("accepts ANALYTICS + VISUAL_BOARD with the empty config", () => {
    const result = shanghaiValidator.validateConfig({
      config: validConfig,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(true);
  });
});

describe("shanghaiValidator.validateBatch — visual board", () => {
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

    const result = shanghaiValidator.validateBatch({
      config: validConfig,
      batch: batch as never,
      existingTurnCounts: {},
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });

    expect(result.valid).toBe(true);
  });

  it("rejects a dartless turn under VISUAL_BOARD capture", () => {
    const result = shanghaiValidator.validateBatch({
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

    const result = shanghaiValidator.validateBatch({
      config: validConfig,
      batch: batch as never,
      existingTurnCounts: {},
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });

    expect(result.valid).toBe(false);
  });
});

describe("shanghaiV2Validator.validateConfig", () => {
  it("accepts RECREATIONAL + DETAILED_DARTS with a NORMAL difficulty config", () => {
    const result = shanghaiV2Validator.validateConfig({
      config: { difficulty: "NORMAL" },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(true);
  });

  it("accepts a HARD difficulty config", () => {
    const result = shanghaiV2Validator.validateConfig({
      config: { difficulty: "HARD" },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a config missing difficulty (the schema requires it)", () => {
    const result = shanghaiV2Validator.validateConfig({
      config: {},
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects an unrecognized difficulty value", () => {
    const result = shanghaiV2Validator.validateConfig({
      config: { difficulty: "IMPOSSIBLE" },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a config carrying an unrecognized key (the schema is .strict())", () => {
    const result = shanghaiV2Validator.validateConfig({
      config: { difficulty: "NORMAL", rounds: 7 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });

  it("accepts ANALYTICS + VISUAL_BOARD with a valid difficulty config", () => {
    const result = shanghaiV2Validator.validateConfig({
      config: { difficulty: "NORMAL" },
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(true);
  });
});
