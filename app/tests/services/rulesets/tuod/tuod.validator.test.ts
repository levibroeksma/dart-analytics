import { describe, it, expect } from "vitest";
import { tuodValidator } from "@services/rulesets/tuod/tuod.validator";
import type { DartFactInput } from "@routes/types";

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

  it("accepts duration_value: 100, the ROUNDS ceiling", () => {
    const result = tuodValidator.validateConfig({
      config: { ...validConfig, duration_value: 100 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects duration_value: 101, one past the ROUNDS ceiling", () => {
    const result = tuodValidator.validateConfig({
      config: { ...validConfig, duration_value: 101 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects duration_value: 2, one below the MINUTES floor", () => {
    const result = tuodValidator.validateConfig({
      config: { ...minutesConfig, duration_value: 2 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(false);
  });

  it("accepts duration_value: 30, the MINUTES ceiling", () => {
    const result = tuodValidator.validateConfig({
      config: { ...minutesConfig, duration_value: 30 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects duration_value: 31, one past the MINUTES ceiling", () => {
    const result = tuodValidator.validateConfig({
      config: { ...minutesConfig, duration_value: 31 },
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
      existingTurnCounts: {},
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(true);
  });

  it("accepts the highest target a ROUNDS ladder can present", () => {
    const result = tuodValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([131]),
      existingTurnCounts: {},
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a total above the ROUNDS ladder ceiling", () => {
    const result = tuodValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([132]),
      existingTurnCounts: {},
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(false);
  });

  it("caps an unbounded MINUTES ladder at the highest three-dart checkout", () => {
    expect(
      tuodValidator.validateBatch({
        config: minutesConfig,
        batch: batchWithTurns([170]),
        existingTurnCounts: {},
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
      }).valid,
    ).toBe(true);
    expect(
      tuodValidator.validateBatch({
        config: minutesConfig,
        batch: batchWithTurns([171]),
        existingTurnCounts: {},
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
      }).valid,
    ).toBe(false);
  });

  it("rejects a batch pushing a ROUNDS session past its attempt count", () => {
    const result = tuodValidator.validateBatch({
      config: { ...validConfig, duration_value: 2 },
      batch: batchWithTurns([0, 0]),
      existingTurnCounts: { p1: 1 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(false);
  });

  it("accepts a 1v1 batch where each seat is under its own ROUNDS budget, even though the combined total is over it", () => {
    const batch = {
      stages: [
        {
          clientKey: "block-1",
          stageTypeKey: "EXERCISE_BLOCK",
          parentClientKey: null,
          sequence: 1,
          turns: [
            {
              clientKey: "t1",
              participantRef: "p2",
              sequence: 1,
              totalScore: 41,
              completedAt: "2026-07-26T10:00:00.000Z",
              darts: [] as DartFactInput[],
            },
          ],
        },
      ],
    };
    const result = tuodValidator.validateBatch({
      config: { ...validConfig, duration_value: 2 },
      batch,
      existingTurnCounts: { p1: 2, p2: 1 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a 1v1 batch when one seat's own attempt count would exceed the ROUNDS budget", () => {
    const batch = {
      stages: [
        {
          clientKey: "block-1",
          stageTypeKey: "EXERCISE_BLOCK",
          parentClientKey: null,
          sequence: 1,
          turns: [
            {
              clientKey: "t1",
              participantRef: "p2",
              sequence: 1,
              totalScore: 41,
              completedAt: "2026-07-26T10:00:00.000Z",
              darts: [] as DartFactInput[],
            },
          ],
        },
      ],
    };
    const result = tuodValidator.validateBatch({
      config: { ...validConfig, duration_value: 2 },
      batch,
      existingTurnCounts: { p1: 2, p2: 2 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(false);
  });

  it("does not cap the attempt count of a MINUTES session", () => {
    const result = tuodValidator.validateBatch({
      config: { ...minutesConfig, duration_value: 2 },
      batch: batchWithTurns([0, 0]),
      existingTurnCounts: { p1: 5 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a negative turn total", () => {
    const result = tuodValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([-1]),
      existingTurnCounts: {},
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
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
        locationX: null,
        locationY: null,
      },
    ];
    const result = tuodValidator.validateBatch({
      config: validConfig,
      batch,
      existingTurnCounts: {},
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(false);
  });
});

function batchWithDarts(
  turns: Array<{
    totalScore: number;
    darts: Array<{
      hitTargetNumber: number | null;
      hitZoneKey: string;
      score: number;
      locationX: number | null;
      locationY: number | null;
    }>;
  }>,
) {
  return {
    stages: [
      {
        clientKey: "block-1",
        stageTypeKey: "EXERCISE_BLOCK",
        parentClientKey: null,
        sequence: 1,
        turns: turns.map((turn, i) => ({
          clientKey: `t${i + 1}`,
          participantRef: "p1",
          sequence: i + 1,
          totalScore: turn.totalScore,
          completedAt: "2026-08-20T10:00:00.000Z",
          darts: turn.darts.map((dart, j) => ({
            sequence: j + 1,
            intendedTargetNumber: null,
            intendedZoneKey: null,
            hitTargetNumber: dart.hitTargetNumber,
            hitZoneKey: dart.hitZoneKey,
            score: dart.score,
            locationX: dart.locationX,
            locationY: dart.locationY,
          })),
        })),
      },
    ],
  };
}

describe("tuodValidator.validateConfig — VISUAL_BOARD", () => {
  it("accepts ANALYTICS + VISUAL_BOARD with a valid config", () => {
    const result = tuodValidator.validateConfig({
      config: validConfig,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(true);
  });

  it("still rejects a mode pair neither capture half supports", () => {
    const result = tuodValidator.validateConfig({
      config: validConfig,
      captureModeKey: "ANALYTICS",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });
});

describe("tuodValidator.validateBatch — VISUAL_BOARD", () => {
  it("accepts a checkout dart re-deriving to the target's double", () => {
    // D20 at (0, -166) — the same coordinate one-twenty-one.validator.test.ts
    // and one-twenty-one.engine.module.test.ts use for D20.
    const result = tuodValidator.validateBatch({
      config: validConfig,
      batch: batchWithDarts([
        {
          totalScore: 40,
          darts: [
            {
              hitTargetNumber: 20,
              hitZoneKey: "DOUBLE",
              score: 40,
              locationX: 0,
              locationY: -166,
            },
          ],
        },
      ]),
      existingTurnCounts: {},
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a dart whose claimed score disagrees with its coordinate", () => {
    const result = tuodValidator.validateBatch({
      config: validConfig,
      batch: batchWithDarts([
        {
          totalScore: 40,
          darts: [
            {
              hitTargetNumber: 20,
              hitZoneKey: "DOUBLE",
              score: 999,
              locationX: 0,
              locationY: -166,
            },
          ],
        },
      ]),
      existingTurnCounts: {},
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(false);
  });

  it("accepts a dartless keypad turn inside a VISUAL_BOARD session", () => {
    const result = tuodValidator.validateBatch({
      config: validConfig,
      batch: batchWithDarts([{ totalScore: 41, darts: [] }]),
      existingTurnCounts: {},
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(true);
  });

  it("still enforces the quick-score path when the session is RECREATIONAL", () => {
    const result = tuodValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([132]),
      existingTurnCounts: {},
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(false);
  });
});
