import { describe, it, expect } from "vitest";
import { CreateRoutineRequest } from "@routes/routines/types";

const step = {
  exerciseTemplateId: "et-1",
  durationTypeKey: "MINUTES",
  durationValue: 10,
};

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
