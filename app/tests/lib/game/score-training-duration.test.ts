import { describe, expect, it } from "vitest";
import {
  clampScoreTrainingDuration,
  scoreTrainingDurationBounds,
  scoreTrainingDurationClampNotice,
} from "@lib/game/score-training-duration";

describe("scoreTrainingDurationBounds", () => {
  it("returns 1–100 for ROUNDS", () => {
    expect(scoreTrainingDurationBounds("ROUNDS")).toEqual({ min: 1, max: 100 });
  });
  it("returns 3–30 for MINUTES", () => {
    expect(scoreTrainingDurationBounds("MINUTES")).toEqual({ min: 3, max: 30 });
  });
});

describe("clampScoreTrainingDuration", () => {
  it("leaves an in-range integer unchanged", () => {
    expect(clampScoreTrainingDuration("ROUNDS", 10)).toEqual({
      value: 10,
      clamped: false,
    });
  });
  it("floors a non-integer then clamps", () => {
    expect(clampScoreTrainingDuration("ROUNDS", 10.9)).toEqual({
      value: 10,
      clamped: true,
    });
  });
  it("clamps above max", () => {
    expect(clampScoreTrainingDuration("MINUTES", 45)).toEqual({
      value: 30,
      clamped: true,
    });
  });
  it("clamps below min, NaN, and non-finite to min", () => {
    expect(clampScoreTrainingDuration("MINUTES", 1)).toEqual({
      value: 3,
      clamped: true,
    });
    expect(clampScoreTrainingDuration("ROUNDS", Number.NaN)).toEqual({
      value: 1,
      clamped: true,
    });
    expect(
      clampScoreTrainingDuration("ROUNDS", Number.POSITIVE_INFINITY),
    ).toEqual({
      value: 1,
      clamped: true,
    });
  });

  it("clamps what x-model.number actually produces for a blank or unparseable field", () => {
    expect(clampScoreTrainingDuration("MINUTES", null)).toEqual({
      value: 3,
      clamped: true,
    });
    expect(clampScoreTrainingDuration("ROUNDS", "abc")).toEqual({
      value: 1,
      clamped: true,
    });
    expect(clampScoreTrainingDuration("ROUNDS", undefined)).toEqual({
      value: 1,
      clamped: true,
    });
  });
});

describe("scoreTrainingDurationClampNotice", () => {
  it("returns the allowed-range copy per mode", () => {
    expect(scoreTrainingDurationClampNotice("ROUNDS")).toBe(
      "Allowed range: 1–100 rounds",
    );
    expect(scoreTrainingDurationClampNotice("MINUTES")).toBe(
      "Allowed range: 3–30 minutes",
    );
  });
});
