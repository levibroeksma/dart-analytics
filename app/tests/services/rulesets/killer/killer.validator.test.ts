import { describe, it, expect } from "vitest";
import { killerValidator } from "@services/rulesets/killer/killer.validator";
import { getRulesetValidator } from "@services/rulesets/registry";
import type { DartFactInput } from "@routes/types";

const d12: DartFactInput = {
  sequence: 1,
  intendedTargetNumber: null,
  intendedZoneKey: null,
  hitTargetNumber: 12,
  hitZoneKey: "DOUBLE",
  score: 24,
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
          participantRef: i % 2 === 0 ? "p1" : "p2",
          sequence: i + 1,
          totalScore: turnDarts.reduce((sum, dart) => sum + dart.score, 0),
          kept: false,
          completedAt: null,
          darts: turnDarts,
        })),
      },
    ],
  };
}

const keypad = (config: unknown) =>
  killerValidator.validateConfig({
    config,
    captureModeKey: "RECREATIONAL",
    inputModeKey: "DETAILED_DARTS",
  });

describe("killerValidator", () => {
  it("is registered for KILLER_V1", () => {
    expect(getRulesetValidator("KILLER_V1")).toBe(killerValidator);
  });

  it.each([
    ["RECREATIONAL", "DETAILED_DARTS"],
    ["ANALYTICS", "VISUAL_BOARD"],
  ])(
    "accepts %s + %s with two distinct numbers",
    (captureModeKey, inputModeKey) => {
      expect(
        killerValidator.validateConfig({
          config: { lives: 3, seat_numbers: [5, 12] },
          captureModeKey,
          inputModeKey,
        }),
      ).toEqual({ valid: true, config: { lives: 3, seat_numbers: [5, 12] } });
    },
  );

  it("rejects RECREATIONAL + QUICK_SCORE", () => {
    expect(
      killerValidator.validateConfig({
        config: { lives: 3, seat_numbers: [5, 12] },
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
      }).valid,
    ).toBe(false);
  });

  it("needs one number per seat", () => {
    expect(keypad({ lives: 3, seat_numbers: [5] })).toEqual({
      valid: false,
      issues: ["Killer needs one number per seat (2)"],
    });
    expect(keypad({ lives: 3 }).valid).toBe(false);
  });

  it("rejects duplicate numbers", () => {
    expect(keypad({ lives: 3, seat_numbers: [5, 5] })).toEqual({
      valid: false,
      issues: ["Seat numbers must differ"],
    });
  });

  it.each([
    ["number 0", { lives: 3, seat_numbers: [0, 12] }],
    ["number 21", { lives: 3, seat_numbers: [5, 21] }],
    ["five lives", { lives: 5, seat_numbers: [5, 12] }],
    ["an unknown key", { lives: 3, seat_numbers: [5, 12], teams: true }],
  ])("rejects %s", (_label, config) => {
    expect(keypad(config).valid).toBe(false);
  });

  it("accepts a visit with darts and rejects a dartless one", () => {
    const validate = (darts: DartFactInput[][]) =>
      killerValidator.validateBatch({
        config: { lives: 3, seat_numbers: [5, 12] },
        batch: batchWithTurns(darts),
        existingTurnCounts: {},
      });
    expect(validate([[d12, { ...d12, sequence: 2 }]]).valid).toBe(true);
    expect(validate([[]]).valid).toBe(false);
  });
});
