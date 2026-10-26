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

  describe("ANALYTICS + VISUAL_BOARD", () => {
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

    const validate = (
      totalScore: number,
      darts: DartFactInput[],
      existing = 0,
    ) => {
      const batch = batchWithTurns([darts]);
      batch.stages[0].turns[0].totalScore = totalScore;
      return baseballValidator.validateBatch({
        config: {},
        batch,
        existingTurnCounts: { p1: existing },
        captureModeKey: "ANALYTICS",
        inputModeKey: "VISUAL_BOARD",
      });
    };

    it("accepts an inning whose total is its runs, not its board sum", () => {
      expect(validate(4, [treble1, treble20, outerSingle1]).valid).toBe(true);
    });

    it("rejects a total that is neither the runs nor 0", () => {
      expect(validate(5, [treble1, treble20, outerSingle1]).valid).toBe(false);
      expect(validate(64, [treble1, treble20, outerSingle1]).valid).toBe(false);
    });

    it("counts only darts on the inning's own number, from the turns already stored", () => {
      expect(validate(0, [treble1, treble20, outerSingle1], 1).valid).toBe(
        true,
      );
      expect(validate(4, [treble1, treble20, outerSingle1], 1).valid).toBe(
        false,
      );
    });
  });

  it("leaves the keypad inning total unchecked against the runs", () => {
    const batch = batchWithTurns([[t1, { ...t1, sequence: 2 }, t1]]);
    batch.stages[0].turns[0].totalScore = 9;
    expect(
      baseballValidator.validateBatch({
        config: {},
        batch,
        existingTurnCounts: {},
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
      }).valid,
    ).toBe(true);
  });
});
