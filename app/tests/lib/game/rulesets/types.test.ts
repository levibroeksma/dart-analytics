import { describe, expect, it } from "vitest";
import {
  FiveOhOneConfig,
  RULESET_CONFIGS,
  ScoreTrainingConfig,
} from "@lib/game/rulesets/types";

describe("FiveOhOneConfig starting_score floor", () => {
  const validRest = {
    legs_to_win: 1,
    check_in: "STRAIGHT_IN",
    check_out: "DOUBLE_OUT",
    max_darts_per_turn: 3,
    max_visit_score: 180,
  };

  it("rejects starting_score: 0, which a double-out leg can never finish from", () => {
    const result = FiveOhOneConfig.safeParse({
      ...validRest,
      starting_score: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects starting_score: 1, since 1 cannot be finished on a double", () => {
    const result = FiveOhOneConfig.safeParse({
      ...validRest,
      starting_score: 1,
    });
    expect(result.success).toBe(false);
  });

  it("accepts starting_score: 2, the minimum finishable double-out score", () => {
    const result = FiveOhOneConfig.safeParse({
      ...validRest,
      starting_score: 2,
    });
    expect(result.success).toBe(true);
  });
});

describe("ScoreTrainingConfig duration_value bounds", () => {
  it("rejects duration_value: 0, one below the shared ROUNDS/MINUTES floor", () => {
    const result = ScoreTrainingConfig.safeParse({
      duration_type: "ROUNDS",
      duration_value: 0,
      max_darts_per_turn: 3,
    });
    expect(result.success).toBe(false);
  });

  it("accepts duration_value: 1, the shared ROUNDS/MINUTES floor", () => {
    const result = ScoreTrainingConfig.safeParse({
      duration_type: "ROUNDS",
      duration_value: 1,
      max_darts_per_turn: 3,
    });
    expect(result.success).toBe(true);
  });

  it("accepts duration_value: 50, the ROUNDS ceiling", () => {
    const result = ScoreTrainingConfig.safeParse({
      duration_type: "ROUNDS",
      duration_value: 50,
      max_darts_per_turn: 3,
    });
    expect(result.success).toBe(true);
  });

  it("rejects duration_value: 51, one past the ROUNDS ceiling", () => {
    const result = ScoreTrainingConfig.safeParse({
      duration_type: "ROUNDS",
      duration_value: 51,
      max_darts_per_turn: 3,
    });
    expect(result.success).toBe(false);
  });

  it("accepts duration_value: 180, the MINUTES ceiling", () => {
    const result = ScoreTrainingConfig.safeParse({
      duration_type: "MINUTES",
      duration_value: 180,
      max_darts_per_turn: 3,
    });
    expect(result.success).toBe(true);
  });

  it("rejects duration_value: 181, one past the MINUTES ceiling", () => {
    const result = ScoreTrainingConfig.safeParse({
      duration_type: "MINUTES",
      duration_value: 181,
      max_darts_per_turn: 3,
    });
    expect(result.success).toBe(false);
  });
});

describe("RULESET_CONFIGS strictness", () => {
  it("rejects a key the schema does not model instead of silently stripping it", () => {
    const result = RULESET_CONFIGS["501_V1"].safeParse({
      starting_score: 501,
      legs_to_win: 1,
      sets_to_win: 1,
      check_in: "STRAIGHT_IN",
      check_out: "DOUBLE_OUT",
      max_darts_per_turn: 3,
    });
    expect(result.success).toBe(false);
  });

  it("still applies defaults for keys the schema does model but the wire config omits", () => {
    const result = RULESET_CONFIGS["501_V1"].safeParse({
      legs_to_win: 1,
      check_in: "STRAIGHT_IN",
      check_out: "DOUBLE_OUT",
      max_darts_per_turn: 3,
    });
    expect(result.success).toBe(true);
  });
});
