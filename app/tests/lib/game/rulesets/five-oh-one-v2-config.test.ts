import { describe, expect, it } from "vitest";
import { FiveOhOneV2Config } from "@lib/types";
import { toSnapshot } from "@lib/game/rulesets/config-codec";

const base = {
  starting_score: 501,
  check_in: "STRAIGHT_IN",
  check_out: "DOUBLE_OUT",
  max_darts_per_turn: 3,
  max_visit_score: 180,
  legs: { mode: "FIRST_TO", count: 3 },
  sets: null,
  win_by_two: null,
};

describe("FiveOhOneV2Config", () => {
  it("accepts a first-to legs match", () => {
    expect(FiveOhOneV2Config.safeParse(base).success).toBe(true);
  });

  it("accepts sets with best-of legs and a deciding-set margin", () => {
    const config = {
      ...base,
      legs: { mode: "BEST_OF", count: 5 },
      sets: { mode: "BEST_OF", count: 3 },
      win_by_two: { cap: 5, scope: "DECIDING_SET" },
    };
    expect(FiveOhOneV2Config.safeParse(config).success).toBe(true);
  });

  it.each([
    ["even best-of legs", { legs: { mode: "BEST_OF", count: 4 } }],
    ["even best-of sets", { sets: { mode: "BEST_OF", count: 2 } }],
    ["legs count 0", { legs: { mode: "FIRST_TO", count: 0 } }],
    ["legs count 21", { legs: { mode: "FIRST_TO", count: 21 } }],
    ["cap below target", { win_by_two: { cap: 2, scope: "EVERY_SET" } }],
    [
      "deciding set without sets",
      { win_by_two: { cap: 5, scope: "DECIDING_SET" } },
    ],
    ["a V1 legs_to_win key", { legs_to_win: 3 }],
  ])("rejects %s", (_label, patch) => {
    expect(FiveOhOneV2Config.safeParse({ ...base, ...patch }).success).toBe(
      false,
    );
  });

  it("decodes to a camelCase snapshot with nested keys untouched", () => {
    const snapshot = toSnapshot("501_V2", {
      ...base,
      win_by_two: { cap: 5, scope: "EVERY_SET" },
    });
    expect(snapshot.winByTwo).toEqual({ cap: 5, scope: "EVERY_SET" });
    expect(snapshot.legs).toEqual({ mode: "FIRST_TO", count: 3 });
    expect(snapshot.sets).toBeNull();
  });
});
