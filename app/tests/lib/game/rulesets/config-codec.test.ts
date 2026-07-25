import { describe, expect, it } from "vitest";
import { toSnapshot, toWireConfig } from "@lib/game/rulesets/config-codec";

describe("config codec", () => {
  it("maps snake_case wire config onto a camelCase snapshot", () => {
    expect(
      toSnapshot("SCORE_TRAINING_V1", {
        duration_type: "ROUNDS",
        duration_value: 10,
        max_darts_per_turn: 3,
        max_visit_score: 180,
      }),
    ).toEqual({
      durationType: "ROUNDS",
      durationValue: 10,
      maxDartsPerTurn: 3,
      maxVisitScore: 180,
    });
  });

  it("round-trips back to wire shape", () => {
    const wire = {
      duration_type: "MINUTES",
      duration_value: 5,
      max_darts_per_turn: 3,
      max_visit_score: 180,
    };
    expect(
      toWireConfig("SCORE_TRAINING_V1", toSnapshot("SCORE_TRAINING_V1", wire)),
    ).toEqual(wire);
  });

  it("applies schema defaults for omitted optional keys", () => {
    const snapshot = toSnapshot("BOBS27_V1", { start_score: 27 });
    expect(snapshot).toEqual({
      startScore: 27,
      bullHitValue: 50,
      missPenaltyMultiplier: 1,
    });
  });

  it("rejects a config that fails its ruleset schema", () => {
    expect(() =>
      toSnapshot("SCORE_TRAINING_V1", { duration_type: "WEEKS" }),
    ).toThrow();
  });

  it("rejects V2+ values the V1 rulesets do not support", () => {
    expect(() =>
      toSnapshot("SINGLES_V1", { order_mode: "RANDOM", difficulty: "HARD" }),
    ).toThrow();
  });

  it("carries the 501 leg count and visit cap", () => {
    const snapshot = toSnapshot("501_V1", {
      starting_score: 501,
      legs_to_win: 3,
      check_in: "STRAIGHT_IN",
      check_out: "DOUBLE_OUT",
      max_darts_per_turn: 3,
      max_visit_score: 180,
    });
    expect(snapshot.legsToWin).toBe(3);
    expect(snapshot.maxVisitScore).toBe(180);
  });
});
