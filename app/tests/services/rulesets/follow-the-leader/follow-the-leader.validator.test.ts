import { describe, it, expect } from "vitest";
import { followTheLeaderValidator } from "@services/rulesets/follow-the-leader/follow-the-leader.validator";
import { getRulesetValidator } from "@services/rulesets/registry";
import type { DartFactInput } from "@routes/types";

const t18: DartFactInput = {
  sequence: 1,
  intendedTargetNumber: null,
  intendedZoneKey: null,
  hitTargetNumber: 18,
  hitZoneKey: "TREBLE",
  score: 54,
  locationX: null,
  locationY: null,
};

type TurnSpec = { darts: DartFactInput[]; kept?: boolean; totalScore?: number };

function batchWithTurns(turns: TurnSpec[]) {
  return {
    stages: [
      {
        clientKey: "block-1",
        stageTypeKey: "EXERCISE_BLOCK",
        parentClientKey: null,
        sequence: 1,
        turns: turns.map((turn, i) => ({
          clientKey: `t${i + 1}`,
          participantRef: i % 2 === 0 ? "p1" : "p2",
          sequence: i + 1,
          totalScore:
            turn.totalScore ??
            turn.darts.reduce((sum, dart) => sum + dart.score, 0),
          kept: turn.kept ?? false,
          completedAt: "2026-10-29T10:00:00.000Z",
          darts: turn.darts,
        })),
      },
    ],
  };
}

const validate = (turns: TurnSpec[]) =>
  followTheLeaderValidator.validateBatch({
    config: { lives: 3 },
    batch: batchWithTurns(turns),
    existingTurnCounts: {},
    captureModeKey: "RECREATIONAL",
    inputModeKey: "DETAILED_DARTS",
  });

const keypad = (config: unknown) =>
  followTheLeaderValidator.validateConfig({
    config,
    captureModeKey: "RECREATIONAL",
    inputModeKey: "DETAILED_DARTS",
  });

describe("followTheLeaderValidator", () => {
  it("is registered for FOLLOW_THE_LEADER_V1", () => {
    expect(getRulesetValidator("FOLLOW_THE_LEADER_V1")).toBe(
      followTheLeaderValidator,
    );
  });

  it.each([
    ["RECREATIONAL", "DETAILED_DARTS"],
    ["ANALYTICS", "VISUAL_BOARD"],
  ])("accepts %s + %s with three lives", (captureModeKey, inputModeKey) => {
    expect(
      followTheLeaderValidator.validateConfig({
        config: { lives: 3 },
        captureModeKey,
        inputModeKey,
      }),
    ).toEqual({ valid: true, config: { lives: 3 } });
  });

  it("defaults the seeded preset to three lives", () => {
    expect(keypad({})).toEqual({ valid: true, config: { lives: 3 } });
  });

  it("rejects RECREATIONAL + QUICK_SCORE", () => {
    expect(
      followTheLeaderValidator.validateConfig({
        config: { lives: 3 },
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
      }).valid,
    ).toBe(false);
  });

  it.each([
    ["five lives", { lives: 5 }],
    ["an unknown key", { lives: 3, teams: true }],
  ])("rejects %s", (_label, config) => {
    expect(keypad(config).valid).toBe(false);
  });

  it("accepts a darted visit and a kept dartless turn", () => {
    expect(validate([{ darts: [t18] }, { darts: [], kept: true }])).toEqual({
      valid: true,
    });
  });

  it("rejects a dartless turn that is not kept", () => {
    expect(validate([{ darts: [] }])).toEqual({
      valid: false,
      code: "VALIDATION_FAILED",
      issues: [
        "turn t1 must carry dart rows — a Follow the Leader visit is up to 3 darts unless it is a keep",
      ],
    });
  });

  it("rejects a kept turn with darts", () => {
    expect(validate([{ darts: [t18], kept: true }])).toEqual({
      valid: false,
      code: "VALIDATION_FAILED",
      issues: ["turn t1 is a keep and must carry no darts and a total of 0"],
    });
  });

  it("rejects a kept turn with a non-zero total", () => {
    expect(validate([{ darts: [], kept: true, totalScore: 54 }]).valid).toBe(
      false,
    );
  });
});
