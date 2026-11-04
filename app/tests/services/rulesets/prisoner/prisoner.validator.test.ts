import { describe, it, expect } from "vitest";
import { prisonerValidator } from "@services/rulesets/prisoner/prisoner.validator";
import { getRulesetValidator } from "@services/rulesets/registry";
import { classify, zoneCentroid } from "@lib/game/board/board-geometry.module";
import type { DartFactInput } from "@routes/types";

/** A dart placed at the centre of `zone` on `n`, its claims read back off the board. */
function located(
  n: number,
  zone: "OUTER_SINGLE" | "INNER_SINGLE",
): DartFactInput {
  const point = zoneCentroid(n, zone);
  if (!point) throw new Error(`no centroid for ${zone} ${n}`);
  const hit = classify(point.x, point.y);
  return {
    sequence: 1,
    intendedTargetNumber: null,
    intendedZoneKey: null,
    hitTargetNumber: hit.targetNumber,
    hitZoneKey: hit.zoneKey,
    score: hit.score,
    locationX: point.x,
    locationY: point.y,
  };
}

const outer1 = located(1, "OUTER_SINGLE");
const inner1 = located(1, "INNER_SINGLE");
const single1: DartFactInput = {
  ...outer1,
  hitZoneKey: "SINGLE",
  locationX: null,
  locationY: null,
};

function turnOf(darts: DartFactInput[]) {
  const numbered = darts.map((dart, i) => ({ ...dart, sequence: i + 1 }));
  return {
    clientKey: "t1",
    participantRef: "p1",
    sequence: 1,
    totalScore: numbered.reduce((sum, dart) => sum + dart.score, 0),
    kept: false,
    completedAt: "2026-10-31T10:00:00.000Z",
    darts: numbered,
  };
}

const validate = (darts: DartFactInput[]) =>
  prisonerValidator.validateBatch({
    config: { darts: 3 },
    batch: {
      stages: [
        {
          clientKey: "block-1",
          stageTypeKey: "EXERCISE_BLOCK",
          parentClientKey: null,
          sequence: 1,
          turns: [turnOf(darts)],
        },
      ],
    },
    existingTurnCounts: {},
    captureModeKey: "ANALYTICS",
    inputModeKey: "VISUAL_BOARD",
  });

const board = (config: unknown) =>
  prisonerValidator.validateConfig({
    config,
    captureModeKey: "ANALYTICS",
    inputModeKey: "VISUAL_BOARD",
  });

describe("prisonerValidator", () => {
  it("is registered for PRISONER_V1", () => {
    expect(getRulesetValidator("PRISONER_V1")).toBe(prisonerValidator);
  });

  it("accepts ANALYTICS + VISUAL_BOARD with three darts, and defaults the preset", () => {
    expect(board({ darts: 3 })).toEqual({ valid: true, config: { darts: 3 } });
    expect(board({})).toEqual({ valid: true, config: { darts: 3 } });
  });

  it.each([
    ["RECREATIONAL", "DETAILED_DARTS"],
    ["RECREATIONAL", "QUICK_SCORE"],
    ["ANALYTICS", "DETAILED_DARTS"],
  ])(
    "rejects %s + %s, naming the board pair",
    (captureModeKey, inputModeKey) => {
      expect(
        prisonerValidator.validateConfig({
          config: { darts: 3 },
          captureModeKey,
          inputModeKey,
        }),
      ).toEqual({
        valid: false,
        issues: ["Prisoner V1 only supports ANALYTICS + VISUAL_BOARD"],
      });
    },
  );

  it.each([
    ["four darts", { darts: 4 }],
    ["an unknown key", { darts: 3, teams: true }],
  ])("rejects %s", (_label, config) => {
    expect(board(config).valid).toBe(false);
  });

  it("accepts a six-dart board visit", () => {
    expect(validate([outer1, inner1, outer1, outer1, inner1, outer1])).toEqual({
      valid: true,
    });
  });

  it("rejects a seven-dart visit", () => {
    expect(validate(Array.from({ length: 7 }, () => outer1))).toEqual({
      valid: false,
      code: "VALIDATION_FAILED",
      issues: ["turn t1 holds 7 darts — a Prisoner visit is at most 6"],
    });
  });

  it("rejects an unbanded SINGLE dart", () => {
    expect(validate([outer1, single1])).toEqual({
      valid: false,
      code: "VALIDATION_FAILED",
      issues: [
        "dart 2 in turn t1 is an unbanded SINGLE — Prisoner needs the inner or outer single",
      ],
    });
  });

  it("delegates the board cross-check", () => {
    expect(validate([{ ...outer1, score: 60 }]).valid).toBe(false);
  });

  it("rejects a dartless turn", () => {
    expect(validate([])).toEqual({
      valid: false,
      code: "VALIDATION_FAILED",
      issues: [
        "turn t1 must carry dart rows — a Prisoner visit is the darts the seat can throw",
      ],
    });
  });
});
