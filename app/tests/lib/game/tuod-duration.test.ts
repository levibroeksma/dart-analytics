import { describe, expect, it } from "vitest";
import {
  clampTuodDuration,
  tuodDurationBounds,
  tuodDurationClampNotice,
} from "@lib/game/tuod-duration";

describe("tuodDurationBounds", () => {
  it("returns 1–100 for ROUNDS", () => {
    expect(tuodDurationBounds("ROUNDS")).toEqual({ min: 1, max: 100 });
  });
  it("returns 3–30 for MINUTES", () => {
    expect(tuodDurationBounds("MINUTES")).toEqual({ min: 3, max: 30 });
  });
});

describe("clampTuodDuration", () => {
  it("leaves an in-range integer unchanged", () => {
    expect(clampTuodDuration("ROUNDS", 10)).toEqual({
      value: 10,
      clamped: false,
    });
  });
  it("floors a non-integer then clamps", () => {
    expect(clampTuodDuration("ROUNDS", 10.9)).toEqual({
      value: 10,
      clamped: true,
    });
  });
  it("clamps above max", () => {
    expect(clampTuodDuration("ROUNDS", 150)).toEqual({
      value: 100,
      clamped: true,
    });
    expect(clampTuodDuration("MINUTES", 45)).toEqual({
      value: 30,
      clamped: true,
    });
  });
  it("clamps below min, NaN, and non-finite to min", () => {
    expect(clampTuodDuration("ROUNDS", 0)).toEqual({
      value: 1,
      clamped: true,
    });
    expect(clampTuodDuration("MINUTES", 1)).toEqual({
      value: 3,
      clamped: true,
    });
    expect(clampTuodDuration("ROUNDS", Number.NaN)).toEqual({
      value: 1,
      clamped: true,
    });
    expect(clampTuodDuration("ROUNDS", Number.POSITIVE_INFINITY)).toEqual({
      value: 1,
      clamped: true,
    });
  });

  it("clamps what x-model.number actually produces for a blank or unparseable field", () => {
    expect(clampTuodDuration("ROUNDS", null)).toEqual({
      value: 1,
      clamped: true,
    });
    expect(clampTuodDuration("MINUTES", "abc")).toEqual({
      value: 3,
      clamped: true,
    });
    expect(clampTuodDuration("ROUNDS", undefined)).toEqual({
      value: 1,
      clamped: true,
    });
  });
});

describe("tuodDurationClampNotice", () => {
  it("returns the allowed-range copy per mode", () => {
    expect(tuodDurationClampNotice("ROUNDS")).toBe(
      "Allowed range: 1–100 rounds",
    );
    expect(tuodDurationClampNotice("MINUTES")).toBe(
      "Allowed range: 3–30 minutes",
    );
  });
});
