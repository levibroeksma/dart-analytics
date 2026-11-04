import { describe, it, expect } from "vitest";
import { mapRoutineStepRow, nonNull } from "@repositories/row-helpers";

describe("nonNull", () => {
  it("returns the value unchanged when it is not null", () => {
    expect(nonNull("sch-1", "schedule_id")).toBe("sch-1");
    expect(nonNull(0, "day_count")).toBe(0);
    expect(nonNull(false, "is_active")).toBe(false);
  });

  it("throws, naming the column, when the value is null", () => {
    expect(() => nonNull(null, "schedule_id")).toThrow(
      'expected view column "schedule_id" to be non-null',
    );
  });
});

describe("mapRoutineStepRow", () => {
  const row = {
    routineId: "rt-1",
    sequenceNumber: 1,
    exerciseTypeKey: "GAME",
    exerciseRulesetVersionKey: null,
    gameTypeKey: "TUOD",
    gameRulesetVersionKey: "TUOD_V1",
    durationTypeKey: "MINUTES",
    durationValue: 10,
    defaultConfiguration: null,
    stepConfiguration: { starting_target: 41 },
  };

  it("returns exactly the nine step keys, in order", () => {
    const step = mapRoutineStepRow(row);
    expect(Object.keys(step)).toEqual([
      "sequenceNumber",
      "exerciseTypeKey",
      "exerciseRulesetVersionKey",
      "gameTypeKey",
      "gameRulesetVersionKey",
      "durationTypeKey",
      "durationValue",
      "defaultConfiguration",
      "stepConfiguration",
    ]);
    expect(step).toEqual({
      sequenceNumber: 1,
      exerciseTypeKey: "GAME",
      exerciseRulesetVersionKey: null,
      gameTypeKey: "TUOD",
      gameRulesetVersionKey: "TUOD_V1",
      durationTypeKey: "MINUTES",
      durationValue: 10,
      defaultConfiguration: null,
      stepConfiguration: { starting_target: 41 },
    });
  });

  it.each([
    ["sequenceNumber", "sequence_number"],
    ["exerciseTypeKey", "exercise_type_key"],
    ["durationTypeKey", "duration_type_key"],
    ["durationValue", "duration_value"],
  ])("throws naming the column when %s is null", (key, column) => {
    expect(() => mapRoutineStepRow({ ...row, [key]: null })).toThrow(
      `expected view column "${column}" to be non-null`,
    );
  });
});
