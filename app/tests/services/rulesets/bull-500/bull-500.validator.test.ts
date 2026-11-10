import { describe, it, expect } from "vitest";
import { bull500Validator } from "@services/rulesets/bull-500/bull-500.validator";
import type { DartFactInput } from "@routes/types";

const LOCKED = { target: 500, live_number: 20 };

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
  bull500Validator.validateBatch({
    config: LOCKED,
    batch: batchWithTurns(darts),
    existingTurnCounts: {},
  });

describe("bull500Validator.validateConfig", () => {
  it.each([
    ["RECREATIONAL", "DETAILED_DARTS"],
    ["ANALYTICS", "VISUAL_BOARD"],
  ])(
    "accepts %s + %s with the locked config",
    (captureModeKey, inputModeKey) => {
      expect(
        bull500Validator.validateConfig({
          config: LOCKED,
          captureModeKey,
          inputModeKey,
        }).valid,
      ).toBe(true);
    },
  );

  it("rejects RECREATIONAL + QUICK_SCORE", () => {
    expect(
      bull500Validator.validateConfig({
        config: LOCKED,
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
      }).valid,
    ).toBe(false);
  });

  it("rejects an empty config and a changed target", () => {
    for (const config of [{}, { target: 300, live_number: 20 }]) {
      expect(
        bull500Validator.validateConfig({
          config,
          captureModeKey: "RECREATIONAL",
          inputModeKey: "DETAILED_DARTS",
        }).valid,
      ).toBe(false);
    }
  });

  it("rejects an unknown config key", () => {
    expect(
      bull500Validator.validateConfig({
        config: { ...LOCKED, variant: "CUT_THROAT" },
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
      }).valid,
    ).toBe(false);
  });
});

describe("bull500Validator.validateBatch", () => {
  it("accepts a full visit followed by a one-dart visit", () => {
    expect(
      validate([[t20, { ...t20, sequence: 2 }, { ...t20, sequence: 3 }], [t20]])
        .valid,
    ).toBe(true);
  });

  it("rejects a four-dart visit", () => {
    const four = [1, 2, 3, 4].map((sequence) => ({ ...t20, sequence }));
    expect(validate([four])).toMatchObject({ valid: false });
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
