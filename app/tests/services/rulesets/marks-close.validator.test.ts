import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createMarksCloseValidator } from "@services/rulesets/marks-close.validator";
import type { DartFactInput } from "@routes/types";

const dart = (
  sequence: number,
  intent: Partial<DartFactInput> = {},
): DartFactInput => ({
  sequence,
  intendedTargetNumber: null,
  intendedZoneKey: null,
  hitTargetNumber: 20,
  hitZoneKey: "TREBLE",
  score: 60,
  locationX: null,
  locationY: null,
  ...intent,
});

function validate(label: string, darts: DartFactInput[]) {
  const validator = createMarksCloseValidator(label, z.object({}));
  return validator.validateBatch({
    config: {},
    batch: {
      stages: [
        {
          clientKey: "block-1",
          stageTypeKey: "EXERCISE_BLOCK",
          parentClientKey: null,
          sequence: 1,
          turns: [
            {
              clientKey: "t1",
              participantRef: "p1",
              sequence: 1,
              totalScore: 0,
              completedAt: null,
              darts,
            },
          ],
        },
      ],
    },
    captureModeKey: "RECREATIONAL",
    inputModeKey: "DETAILED_DARTS",
    existingTurnCounts: {},
  } as Parameters<typeof validator.validateBatch>[0]);
}

describe("createMarksCloseValidator", () => {
  it("rejects a visit of more than 3 darts", () => {
    const result = validate("Cricket", [dart(1), dart(2), dart(3), dart(4)]);
    expect(result).toMatchObject({
      valid: false,
      issues: ["turn t1 holds more than 3 darts"],
    });
  });

  it("names the game in the no-intent rejection", () => {
    const result = validate("Tactics", [dart(1, { intendedTargetNumber: 20 })]);
    expect(result).toMatchObject({
      valid: false,
      issues: ["turn t1 dart 1 must carry no intent — Tactics stores none"],
    });
  });

  it("accepts a visit shorter than 3 darts with no intent", () => {
    expect(validate("Cricket", [dart(1)])).toMatchObject({ valid: true });
  });
});
