import { describe, it, expect } from "vitest";
import { fivesValidator } from "@services/rulesets/fives/fives.validator";
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
          kept: false,
          darts: turnDarts,
        })),
      },
    ],
  };
}

const validate = (darts: DartFactInput[][]) =>
  fivesValidator.validateBatch({
    config: {},
    batch: batchWithTurns(darts),
    existingTurnCounts: {},
  });

describe("fivesValidator.validateConfig", () => {
  it.each([
    ["RECREATIONAL", "DETAILED_DARTS"],
    ["ANALYTICS", "VISUAL_BOARD"],
  ])("accepts %s + %s with {}", (captureModeKey, inputModeKey) => {
    expect(
      fivesValidator.validateConfig({
        config: {},
        captureModeKey,
        inputModeKey,
      }).valid,
    ).toBe(true);
  });

  it("rejects RECREATIONAL + QUICK_SCORE", () => {
    expect(
      fivesValidator.validateConfig({
        config: {},
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
      }).valid,
    ).toBe(false);
  });

  it("rejects an unknown config key", () => {
    expect(
      fivesValidator.validateConfig({
        config: { variant: "CUT_THROAT" },
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
      }).valid,
    ).toBe(false);
  });
});

describe("fivesValidator.validateBatch", () => {
  it("accepts a full visit followed by a one-dart visit", () => {
    expect(
      validate([[t20, { ...t20, sequence: 2 }, { ...t20, sequence: 3 }], [t20]])
        .valid,
    ).toBe(true);
  });

  it("accepts an off-board dart as a MISS dart with score 0", () => {
    const off: DartFactInput = {
      ...t20,
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      score: 0,
    };
    expect(validate([[off, { ...off, sequence: 2 }, t20]]).valid).toBe(true);
  });

  it("rejects a dartless visit", () => {
    expect(validate([[]])).toMatchObject({ valid: false });
  });
});
