import { describe, it, expect } from "vitest";
import {
  shanghaiValidator,
  shanghaiV2Validator,
  shanghaiV3Validator,
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
              totalScore: 3,
              completedAt: "2026-08-15T12:00:00.000Z",
              darts: [
                {
                  sequence: 1,
                  intendedTargetNumber: null,
                  intendedZoneKey: null,
                  hitTargetNumber: 1,
                  hitZoneKey: "TREBLE",
                  score: 3,
                  locationX: 31,
                  locationY: -95,
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

describe("shanghaiV3Validator.validateConfig", () => {
  const v3 = {
    difficulty: "NORMAL",
    range_start: 13,
    range_end: 20,
    instant_win: false,
  };
  const validate = (config: unknown) =>
    shanghaiV3Validator.validateConfig({
      config,
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });

  it("accepts a ranged, score-only config", () => {
    expect(validate(v3).valid).toBe(true);
  });

  it.each([
    ["a V2-shaped config", { difficulty: "NORMAL" }],
    ["an inverted range", { ...v3, range_start: 14, range_end: 13 }],
    ["an out-of-range end", { ...v3, range_end: 21 }],
    ["an unrecognized key", { ...v3, rounds: 7 }],
  ])("rejects %s", (_name, config) => {
    expect(validate(config).valid).toBe(false);
  });
});

describe("shanghaiValidator.validateBatch ANALYTICS + VISUAL_BOARD", () => {
  const dart = (
    sequence: number,
    hitTargetNumber: number,
    hitZoneKey: string,
    score: number,
    locationX: number,
    locationY: number,
  ): DartFactInput => ({
    sequence,
    intendedTargetNumber: null,
    intendedZoneKey: null,
    hitTargetNumber,
    hitZoneKey,
    score,
    locationX,
    locationY,
  });
  const treble1 = dart(1, 1, "TREBLE", 3, 31, -95);
  const treble20 = dart(2, 20, "TREBLE", 60, 0, -102);
  const outerSingle1 = dart(3, 1, "OUTER_SINGLE", 1, 35, -110);
  const darts = [treble1, treble20, outerSingle1];

  const validate = (
    totalScore: number,
    turnDarts: DartFactInput[],
    existing = 0,
    config: Record<string, unknown> = {},
  ) => {
    const batch = batchWithTurns([turnDarts]);
    batch.stages[0].turns[0].totalScore = totalScore;
    return shanghaiV3Validator.validateBatch({
      config,
      batch,
      existingTurnCounts: { p1: existing },
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
  };

  it("accepts a visit whose total is its points on the round's number, not its board sum", () => {
    expect(validate(4, darts).valid).toBe(true);
  });

  it("rejects a total that is neither those points nor 0", () => {
    expect(validate(5, darts).valid).toBe(false);
    expect(validate(64, darts).valid).toBe(false);
  });

  it("takes the round from the turns already stored and the range start", () => {
    expect(validate(0, darts, 1).valid).toBe(true);
    expect(validate(4, darts, 1).valid).toBe(false);
    expect(validate(60, darts, 0, { rangeStart: 20 }).valid).toBe(true);
  });

  it("accepts a negative total only for a visit with no point on the number (Hard halving)", () => {
    expect(validate(-12, darts, 1).valid).toBe(true);
    expect(validate(-12, darts).valid).toBe(false);
  });
});
