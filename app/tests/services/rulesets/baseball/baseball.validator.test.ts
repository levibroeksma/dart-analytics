import { describe, it, expect } from "vitest";
import { baseballValidator } from "@services/rulesets/baseball/baseball.validator";
import { getRulesetValidator } from "@services/rulesets/registry";
import type { DartFactInput } from "@routes/types";

const t1: DartFactInput = {
  sequence: 1,
  intendedTargetNumber: null,
  intendedZoneKey: null,
  hitTargetNumber: 1,
  hitZoneKey: "TREBLE",
  score: 3,
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
          totalScore: 0,
          completedAt: null,
          darts: turnDarts,
        })),
      },
    ],
  };
}

describe("baseballValidator", () => {
  it("is registered for BASEBALL_V1", () => {
    expect(getRulesetValidator("BASEBALL_V1")).toBe(baseballValidator);
  });

  it.each([
    ["RECREATIONAL", "DETAILED_DARTS"],
    ["ANALYTICS", "VISUAL_BOARD"],
  ])("accepts %s + %s with {}", (captureModeKey, inputModeKey) => {
    expect(
      baseballValidator.validateConfig({
        config: {},
        captureModeKey,
        inputModeKey,
      }).valid,
    ).toBe(true);
  });

  it("rejects RECREATIONAL + QUICK_SCORE and any config key", () => {
    expect(
      baseballValidator.validateConfig({
        config: {},
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
      }).valid,
    ).toBe(false);
    expect(
      baseballValidator.validateConfig({
        config: { innings: 9 },
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
      }).valid,
    ).toBe(false);
  });

  it("accepts a three-dart inning and rejects a dartless one", () => {
    const validate = (darts: DartFactInput[][]) =>
      baseballValidator.validateBatch({
        config: {},
        batch: batchWithTurns(darts),
        existingTurnCounts: {},
      });
    expect(
      validate([[t1, { ...t1, sequence: 2 }, { ...t1, sequence: 3 }]]).valid,
    ).toBe(true);
    expect(validate([[]]).valid).toBe(false);
  });
});
