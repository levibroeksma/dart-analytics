import { describe, it, expect } from "vitest";
import {
  DEDICATED_STATS_LAYOUTS,
  HEATMAP_ONLY_LAYOUTS,
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

describe("HEATMAP_ONLY_LAYOUTS", () => {
  it("holds the plain-heatmap games, never a dedicated layout", () => {
    expect([...HEATMAP_ONLY_LAYOUTS].sort()).toEqual(
      [
        "121_V1",
        "501_V1",
        "AROUND_THE_CLOCK_V1",
        "BOBS27_V1",
        "CRICKET_V1",
        "DOUBLES_TRAINING_V1",
        "SHANGHAI_V1",
        "SINGLES_V1",
        "TACTICS_V1",
        "TUOD_V1",
      ].sort(),
    );
    for (const key of HEATMAP_ONLY_LAYOUTS)
      expect(DEDICATED_STATS_LAYOUTS.has(key)).toBe(false);
  });
});
