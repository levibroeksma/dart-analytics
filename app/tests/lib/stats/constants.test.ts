import { describe, it, expect } from "vitest";
import { GAME_TYPE_BY_RULESET } from "@lib/game/rulesets/capabilities";
import {
  ACE_LAYOUTS,
  CHECKOUT_LAYOUTS,
  DOUBLES_TRAINING_LAYOUTS,
  HEATMAP_ONLY_LAYOUTS,
  MARKS_LAYOUTS,
  MAX_LANDING_DARTS,
  MIN_ROW_SAMPLE,
  MIN_TARGET_SAMPLE,
  NEAR_MISS_MM,
  TRACK_LAYOUTS,
  X01_LAYOUTS,
} from "@lib/stats/constants";

describe("MIN_TARGET_SAMPLE", () => {
  it("is a positive integer", () => {
    expect(Number.isInteger(MIN_TARGET_SAMPLE)).toBe(true);
    expect(MIN_TARGET_SAMPLE).toBeGreaterThan(0);
  });
});

/** Score Training's dedicated layout, selected by name on `/statistics` (`index.astro`); no other layout set may claim it. */
const SCORE_TRAINING_LAYOUT: ReadonlySet<string> = new Set([
  "SCORE_TRAINING_V1",
]);

describe("HEATMAP_ONLY_LAYOUTS", () => {
  it("holds the plain-heatmap games, never a dedicated layout", () => {
    expect([...HEATMAP_ONLY_LAYOUTS].sort()).toEqual(
      [
        "BASEBALL_V1",
        "BULL_500_V1",
        "FIVES_V1",
        "FOLLOW_THE_LEADER_V1",
        "KILLER_V1",
        "PRISONER_V1",
      ].sort(),
    );
    for (const key of HEATMAP_ONLY_LAYOUTS)
      expect(SCORE_TRAINING_LAYOUT.has(key)).toBe(false);
  });
});

describe("ACE_LAYOUTS", () => {
  it("holds ACE_V1, outside every other layout set", () => {
    expect([...ACE_LAYOUTS]).toEqual(["ACE_V1"]);
    for (const other of [
      HEATMAP_ONLY_LAYOUTS,
      SCORE_TRAINING_LAYOUT,
      DOUBLES_TRAINING_LAYOUTS,
      TRACK_LAYOUTS,
      X01_LAYOUTS,
    ])
      expect(other.has("ACE_V1")).toBe(false);
  });
});

describe("TRACK_LAYOUTS", () => {
  it("holds the four per-target Track games, outside every other layout set", () => {
    expect([...TRACK_LAYOUTS].sort()).toEqual([
      "AROUND_THE_CLOCK_V1",
      "BOBS27_V1",
      "SHANGHAI_V1",
      "SINGLES_V1",
    ]);
    for (const key of TRACK_LAYOUTS) {
      expect(HEATMAP_ONLY_LAYOUTS.has(key)).toBe(false);
      expect(SCORE_TRAINING_LAYOUT.has(key)).toBe(false);
      expect(DOUBLES_TRAINING_LAYOUTS.has(key)).toBe(false);
      expect(X01_LAYOUTS.has(key)).toBe(false);
    }
    expect(HEATMAP_ONLY_LAYOUTS.has("BASEBALL_V1")).toBe(true);
  });
});

describe("DOUBLES_TRAINING_LAYOUTS", () => {
  it("holds DOUBLES_TRAINING_V1, outside every other layout set", () => {
    expect([...DOUBLES_TRAINING_LAYOUTS]).toEqual(["DOUBLES_TRAINING_V1"]);
    for (const key of DOUBLES_TRAINING_LAYOUTS) {
      expect(HEATMAP_ONLY_LAYOUTS.has(key)).toBe(false);
      expect(SCORE_TRAINING_LAYOUT.has(key)).toBe(false);
      expect(X01_LAYOUTS.has(key)).toBe(false);
    }
  });
});

describe("X01_LAYOUTS", () => {
  it("holds the 501 ruleset versions, outside the heatmap-only and dedicated sets", () => {
    expect([...X01_LAYOUTS].sort()).toEqual(["501_V1", "501_V2"]);
    for (const key of X01_LAYOUTS) {
      expect(HEATMAP_ONLY_LAYOUTS.has(key)).toBe(false);
      expect(SCORE_TRAINING_LAYOUT.has(key)).toBe(false);
    }
  });
});

describe("X01_LAYOUTS against the ruleset table", () => {
  it("names exactly the ruleset versions of game type 501", () => {
    const keys = Object.entries(GAME_TYPE_BY_RULESET)
      .filter(([, gameTypeKey]) => gameTypeKey === "501")
      .map(([rulesetVersionKey]) => rulesetVersionKey)
      .sort();
    expect([...X01_LAYOUTS].sort()).toEqual(keys);
  });
});

describe("MIN_ROW_SAMPLE", () => {
  it("is a positive integer below MIN_TARGET_SAMPLE", () => {
    expect(Number.isInteger(MIN_ROW_SAMPLE)).toBe(true);
    expect(MIN_ROW_SAMPLE).toBeGreaterThan(0);
    expect(MIN_ROW_SAMPLE).toBeLessThan(MIN_TARGET_SAMPLE);
  });
});

describe("near-miss constants", () => {
  it("sets the near-miss threshold at 20 mm", () => {
    expect(NEAR_MISS_MM).toBe(20);
  });

  it("caps a per-dart landing read at 50,000 darts", () => {
    expect(MAX_LANDING_DARTS).toBe(50_000);
  });
});

describe("CHECKOUT_LAYOUTS", () => {
  it("holds 121 (both versions) and TUOD, outside every other layout set", () => {
    expect([...CHECKOUT_LAYOUTS].sort()).toEqual([
      "121_V1",
      "121_V2",
      "TUOD_V1",
    ]);
    for (const other of [
      HEATMAP_ONLY_LAYOUTS,
      SCORE_TRAINING_LAYOUT,
      DOUBLES_TRAINING_LAYOUTS,
      TRACK_LAYOUTS,
      ACE_LAYOUTS,
      X01_LAYOUTS,
    ])
      for (const key of CHECKOUT_LAYOUTS) expect(other.has(key)).toBe(false);
  });
});

describe("MARKS_LAYOUTS", () => {
  it("holds Cricket, Tactics and Mickey Mouse, outside every other layout set", () => {
    expect([...MARKS_LAYOUTS].sort()).toEqual([
      "CRICKET_V1",
      "CRICKET_V2",
      "MICKEY_MOUSE_V1",
      "TACTICS_V1",
      "TACTICS_V2",
    ]);
    for (const other of [
      HEATMAP_ONLY_LAYOUTS,
      SCORE_TRAINING_LAYOUT,
      DOUBLES_TRAINING_LAYOUTS,
      TRACK_LAYOUTS,
      ACE_LAYOUTS,
      CHECKOUT_LAYOUTS,
      X01_LAYOUTS,
    ])
      for (const key of MARKS_LAYOUTS) expect(other.has(key)).toBe(false);
  });
});
