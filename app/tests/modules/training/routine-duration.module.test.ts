import { describe, expect, it } from "vitest";
import {
  MAX_ROUTINE_MINUTES,
  validateRoutineDuration,
} from "@modules/training/routine-duration.module";

const minutes = (sequenceNumber: number, durationValue: number) => ({
  sequenceNumber,
  durationTypeKey: "MINUTES" as const,
  durationValue,
});

describe("validateRoutineDuration", () => {
  it("caps a routine at sixty minutes", () => {
    expect(MAX_ROUTINE_MINUTES).toBe(60);
  });

  it("accepts a routine at exactly the cap", () => {
    const result = validateRoutineDuration([minutes(1, 30), minutes(2, 30)]);

    expect(result).toEqual({ ok: true, totalMinutes: 60 });
  });

  it("rejects a routine over the cap", () => {
    const result = validateRoutineDuration([minutes(1, 40), minutes(2, 21)]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.join(" ")).toContain("61");
  });

  it("rejects an empty routine", () => {
    const result = validateRoutineDuration([]);

    expect(result.ok).toBe(false);
  });

  it("rejects a non-positive duration", () => {
    const result = validateRoutineDuration([minutes(1, 0)]);

    expect(result.ok).toBe(false);
  });

  it("rejects duplicate sequence numbers", () => {
    const result = validateRoutineDuration([minutes(1, 10), minutes(1, 10)]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.join(" ")).toContain("sequence");
  });

  it("rejects a gap in the sequence", () => {
    const result = validateRoutineDuration([minutes(1, 10), minutes(3, 10)]);

    expect(result.ok).toBe(false);
  });

  it("counts a ROUNDS step as zero minutes", () => {
    const result = validateRoutineDuration([
      minutes(1, 55),
      { sequenceNumber: 2, durationTypeKey: "ROUNDS", durationValue: 20 },
    ]);

    expect(result).toEqual({ ok: true, totalMinutes: 55 });
  });

  it("accepts the seeded five-minute warm-up routine", () => {
    expect(validateRoutineDuration([minutes(1, 5)])).toEqual({
      ok: true,
      totalMinutes: 5,
    });
  });
});
