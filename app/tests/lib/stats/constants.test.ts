import { describe, it, expect } from "vitest";
import {
  DEDICATED_STATS_LAYOUTS,
  MIN_TARGET_SAMPLE,
} from "@lib/stats/constants";

describe("MIN_TARGET_SAMPLE", () => {
  it("is a positive integer", () => {
    expect(Number.isInteger(MIN_TARGET_SAMPLE)).toBe(true);
    expect(MIN_TARGET_SAMPLE).toBeGreaterThan(0);
  });
});

describe("DEDICATED_STATS_LAYOUTS", () => {
  it("holds SCORE_TRAINING_V1 only", () => {
    expect([...DEDICATED_STATS_LAYOUTS]).toEqual(["SCORE_TRAINING_V1"]);
  });
});
