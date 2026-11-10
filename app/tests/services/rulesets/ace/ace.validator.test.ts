import { describe, it, expect } from "vitest";
import { aceValidator } from "@services/rulesets/ace/ace.validator";
import type { DartFactInput } from "@routes/types";

const CONFIG = { rounds: 8, drawSeed: 42 };

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
  aceValidator.validateBatch({
    config: CONFIG,
    batch: batchWithTurns(darts),
    existingTurnCounts: {},
  });

const validateConfig = (config: unknown, inputModeKey = "DETAILED_DARTS") =>
  aceValidator.validateConfig({
    config,
    captureModeKey:
      inputModeKey === "VISUAL_BOARD" ? "ANALYTICS" : "RECREATIONAL",
    inputModeKey,
  });

describe("aceValidator.validateConfig", () => {
  it.each([
    ["RECREATIONAL", "DETAILED_DARTS"],
    ["ANALYTICS", "VISUAL_BOARD"],
  ])(
    "accepts %s + %s with rounds and a draw seed",
    (captureModeKey, inputModeKey) => {
      expect(
        aceValidator.validateConfig({
          config: CONFIG,
          captureModeKey,
          inputModeKey,
        }).valid,
      ).toBe(true);
    },
  );

  it("rejects RECREATIONAL + QUICK_SCORE", () => {
    expect(
      aceValidator.validateConfig({
        config: CONFIG,
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
      }).valid,
    ).toBe(false);
  });

  it.each([2, 13, 7.5])("rejects %s rounds", (rounds) => {
    expect(validateConfig({ ...CONFIG, rounds }).valid).toBe(false);
  });

  it.each([3, 12])("accepts %s rounds", (rounds) => {
    expect(validateConfig({ ...CONFIG, rounds }).valid).toBe(true);
  });

  it("rejects a missing or out-of-range draw seed", () => {
    expect(validateConfig({ rounds: 8 }).valid).toBe(false);
    expect(validateConfig({ ...CONFIG, drawSeed: -1 }).valid).toBe(false);
    expect(validateConfig({ ...CONFIG, drawSeed: 2 ** 32 }).valid).toBe(false);
  });

  it("rejects an unknown config key", () => {
    expect(validateConfig({ ...CONFIG, extra: true }).valid).toBe(false);
  });
});

describe("aceValidator.validateBatch", () => {
  it("accepts a turn with dart rows", () => {
    expect(validate([[t20]]).valid).toBe(true);
  });

  it("rejects a dartless turn", () => {
    expect(validate([[]]).valid).toBe(false);
  });
});
