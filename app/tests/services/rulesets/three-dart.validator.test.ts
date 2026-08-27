import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createThreeDartValidator } from "@services/rulesets/three-dart.validator";
import type { DartFactInput } from "@routes/types";

const TestConfig = z.object({ rounds: z.number() }).strict();

const validator = createThreeDartValidator({
  label: "Test Game",
  configSchema: TestConfig,
  dartlessIssue: (clientKey) => `turn ${clientKey} needs darts`,
});

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

describe("createThreeDartValidator — validateConfig", () => {
  it("accepts RECREATIONAL + DETAILED_DARTS", () => {
    const result = validator.validateConfig({
      config: { rounds: 20 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(true);
  });

  it("accepts ANALYTICS + VISUAL_BOARD", () => {
    const result = validator.validateConfig({
      config: { rounds: 20 },
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(true);
  });

  it("names the label in the rejection for an unsupported mode pair", () => {
    const result = validator.validateConfig({
      config: { rounds: 20 },
      captureModeKey: "ANALYTICS",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
    expect(JSON.stringify(result)).toContain("Test Game V1 only supports");
  });

  it("runs the caller's own schema, strictness included", () => {
    const result = validator.validateConfig({
      config: { rounds: 20, extra: true },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });
});

describe("createThreeDartValidator — validateBatch", () => {
  it("accepts turns carrying dart rows with non-negative scores", () => {
    const result = validator.validateBatch({
      config: { rounds: 20 },
      batch: batchWithTurns([[hitDart]]),
      existingTurnCounts: {},
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a dartless turn with the caller's own message", () => {
    const result = validator.validateBatch({
      config: { rounds: 20 },
      batch: batchWithTurns([[]]),
      existingTurnCounts: {},
    });
    expect(result.valid).toBe(false);
    expect(JSON.stringify(result)).toContain("turn t1 needs darts");
  });

  it("rejects a dart with a negative score", () => {
    const result = validator.validateBatch({
      config: { rounds: 20 },
      batch: batchWithTurns([[{ ...hitDart, score: -1 }]]),
      existingTurnCounts: {},
    });
    expect(result.valid).toBe(false);
  });

  it("checks the dartless rule before branching on capture mode", () => {
    const result = validator.validateBatch({
      config: { rounds: 20 },
      batch: batchWithTurns([[]]),
      existingTurnCounts: {},
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(false);
    expect(JSON.stringify(result)).toContain("turn t1 needs darts");
  });
});
