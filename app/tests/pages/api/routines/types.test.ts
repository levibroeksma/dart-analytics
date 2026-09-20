import { describe, it, expect } from "vitest";
import {
  CreateRoutineRequest,
  MAX_ROUTINE_STEP_MINUTES,
  MAX_ROUTINE_STEPS,
  MAX_ROUTINE_NAME_LENGTH,
  RoutineStep,
} from "@routes/routines/types";

const step = {
  exerciseTemplateId: "et-1",
  durationTypeKey: "MINUTES",
  durationValue: 10,
};

describe("MAX_ROUTINE_STEP_MINUTES / MAX_ROUTINE_STEPS / MAX_ROUTINE_NAME_LENGTH", () => {
  it("names the bounds the schema enforces, so a consumer can import rather than restate them", () => {
    expect(MAX_ROUTINE_STEP_MINUTES).toBe(60);
    expect(MAX_ROUTINE_STEPS).toBe(12);
    expect(MAX_ROUTINE_NAME_LENGTH).toBe(60);
  });
});

describe("CreateRoutineRequest", () => {
  it("accepts a trimmed name, null description and MINUTES steps", () => {
    const parsed = CreateRoutineRequest.safeParse({
      name: " A ",
      steps: [step, step, step],
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.name).toBe("A");
    expect(parsed.data.description).toBeNull();
  });

  it("rejects ROUNDS steps, empty steps, more than 12 steps, and minutes outside 1..60", () => {
    expect(
      CreateRoutineRequest.safeParse({
        name: "A",
        steps: [{ ...step, durationTypeKey: "ROUNDS" }],
      }).success,
    ).toBe(false);
    expect(
      CreateRoutineRequest.safeParse({ name: "A", steps: [] }).success,
    ).toBe(false);
    expect(
      CreateRoutineRequest.safeParse({ name: "A", steps: Array(13).fill(step) })
        .success,
    ).toBe(false);
    expect(
      CreateRoutineRequest.safeParse({
        name: "A",
        steps: [{ ...step, durationValue: 0 }],
      }).success,
    ).toBe(false);
    expect(
      CreateRoutineRequest.safeParse({
        name: "A",
        steps: [{ ...step, durationValue: 61 }],
      }).success,
    ).toBe(false);
  });

  it("rejects a blank name, a 61-char name and a 281-char description", () => {
    expect(
      CreateRoutineRequest.safeParse({ name: "   ", steps: [step] }).success,
    ).toBe(false);
    expect(
      CreateRoutineRequest.safeParse({ name: "x".repeat(61), steps: [step] })
        .success,
    ).toBe(false);
    expect(
      CreateRoutineRequest.safeParse({
        name: "A",
        description: "x".repeat(281),
        steps: [step],
      }).success,
    ).toBe(false);
  });

  it("strips a client-sent sequenceNumber", () => {
    const parsed = CreateRoutineRequest.safeParse({
      name: "A",
      steps: [{ ...step, sequenceNumber: 9 }],
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.steps[0]).not.toHaveProperty("sequenceNumber");
  });
});

describe("RoutineStep", () => {
  it("accepts a GAME step's pinned game ruleset version key", () => {
    const parsed = RoutineStep.safeParse({
      sequenceNumber: 4,
      exerciseTemplateId: "et-fin",
      exerciseName: "Finishing",
      exerciseDescription: null,
      exerciseTypeKey: "GAME",
      gameTypeKey: "TUOD",
      gameRulesetVersionKey: "TUOD_V1",
      durationValue: 10,
      durationTypeKey: "MINUTES",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a non-game step with a null game ruleset version key", () => {
    const parsed = RoutineStep.safeParse({
      sequenceNumber: 1,
      exerciseTemplateId: "et-warm",
      exerciseName: "Warm-Up",
      exerciseDescription: null,
      exerciseTypeKey: "WARM_UP",
      gameTypeKey: null,
      gameRulesetVersionKey: null,
      durationValue: 10,
      durationTypeKey: "MINUTES",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a row missing gameRulesetVersionKey", () => {
    const parsed = RoutineStep.safeParse({
      sequenceNumber: 1,
      exerciseTemplateId: "et-warm",
      exerciseName: "Warm-Up",
      exerciseDescription: null,
      exerciseTypeKey: "WARM_UP",
      gameTypeKey: null,
      durationValue: 10,
      durationTypeKey: "MINUTES",
    });
    expect(parsed.success).toBe(false);
  });
});
