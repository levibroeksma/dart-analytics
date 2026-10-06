import { describe, it, expect } from "vitest";
import { tacticsValidator } from "@services/rulesets/tactics/tactics.validator";
import type { DartFactInput } from "@routes/types";

const t20: DartFactInput = {
  sequence: 1,
  intendedTargetNumber: null,
  intendedZoneKey: null,
  hitTargetNumber: 20,
  hitZoneKey: "TREBLE",
  score: 60,
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
          totalScore: turnDarts.reduce((total, d) => total + d.score, 0),
          completedAt: null,
          darts: turnDarts,
        })),
      },
    ],
  };
}

const validate = (darts: DartFactInput[][]) =>
  tacticsValidator.validateBatch({
    config: {},
    batch: batchWithTurns(darts),
    existingTurnCounts: {},
  });

describe("tacticsValidator.validateConfig", () => {
  it.each([
    ["RECREATIONAL", "DETAILED_DARTS"],
    ["ANALYTICS", "VISUAL_BOARD"],
  ])("accepts %s + %s with {}", (captureModeKey, inputModeKey) => {
    expect(
      tacticsValidator.validateConfig({
        config: {},
        captureModeKey,
        inputModeKey,
      }).valid,
    ).toBe(true);
  });

  it("rejects RECREATIONAL + QUICK_SCORE", () => {
    expect(
      tacticsValidator.validateConfig({
        config: {},
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
      }).valid,
    ).toBe(false);
  });

  it("rejects an unknown config key", () => {
    expect(
      tacticsValidator.validateConfig({
        config: { variant: "CUT_THROAT" },
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
      }).valid,
    ).toBe(false);
  });
});

describe("tacticsValidator.validateBatch", () => {
  it("accepts a short closing visit", () => {
    expect(
      validate([[t20, { ...t20, sequence: 2 }, { ...t20, sequence: 3 }], [t20]])
        .valid,
    ).toBe(true);
  });

  it("accepts a double on 1–14 as a true hit fact", () => {
    const d7: DartFactInput = {
      ...t20,
      hitTargetNumber: 7,
      hitZoneKey: "DOUBLE",
      score: 14,
    };
    expect(validate([[d7]]).valid).toBe(true);
  });

  it("rejects a dart carrying intent", () => {
    const result = validate([
      [{ ...t20, intendedTargetNumber: 20, intendedZoneKey: "TREBLE" }],
    ]);
    expect(result).toMatchObject({ valid: false, code: "VALIDATION_FAILED" });
  });

  it("rejects a visit of 4 darts", () => {
    const four = [1, 2, 3, 4].map((sequence) => ({ ...t20, sequence }));
    expect(validate([four])).toMatchObject({ valid: false });
  });

  it("rejects a dartless visit", () => {
    expect(validate([[]])).toMatchObject({ valid: false });
  });
});
