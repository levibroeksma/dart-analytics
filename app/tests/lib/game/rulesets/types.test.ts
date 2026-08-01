import { describe, expect, it } from "vitest";
import {
  FiveOhOneConfig,
  RULESET_CONFIGS,
  ScoreTrainingConfig,
  TuodConfig,
} from "@lib/types";

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
  it("rejects duration_value: 0 for ROUNDS, one below the floor", () => {
    const result = ScoreTrainingConfig.safeParse({
      duration_type: "ROUNDS",
      duration_value: 0,
      max_darts_per_turn: 3,
    });
    expect(result.success).toBe(false);
  });

  it("accepts duration_value: 1 for ROUNDS, the floor", () => {
    const result = ScoreTrainingConfig.safeParse({
      duration_type: "ROUNDS",
      duration_value: 1,
      max_darts_per_turn: 3,
    });
    expect(result.success).toBe(true);
  });

  it("accepts duration_value: 100 for ROUNDS, the ceiling", () => {
    const result = ScoreTrainingConfig.safeParse({
      duration_type: "ROUNDS",
      duration_value: 100,
      max_darts_per_turn: 3,
    });
    expect(result.success).toBe(true);
  });

  it("rejects duration_value: 101 for ROUNDS, one past the ceiling", () => {
    const result = ScoreTrainingConfig.safeParse({
      duration_type: "ROUNDS",
      duration_value: 101,
      max_darts_per_turn: 3,
    });
    expect(result.success).toBe(false);
  });

  it("rejects duration_value: 2 for MINUTES, one below the floor", () => {
    const result = ScoreTrainingConfig.safeParse({
      duration_type: "MINUTES",
      duration_value: 2,
      max_darts_per_turn: 3,
    });
    expect(result.success).toBe(false);
  });

  it("accepts duration_value: 3 for MINUTES, the floor", () => {
    const result = ScoreTrainingConfig.safeParse({
      duration_type: "MINUTES",
      duration_value: 3,
      max_darts_per_turn: 3,
    });
    expect(result.success).toBe(true);
  });

  it("accepts duration_value: 30 for MINUTES, the ceiling", () => {
    const result = ScoreTrainingConfig.safeParse({
      duration_type: "MINUTES",
      duration_value: 30,
      max_darts_per_turn: 3,
    });
    expect(result.success).toBe(true);
  });

  it("rejects duration_value: 31 for MINUTES, one past the ceiling", () => {
    const result = ScoreTrainingConfig.safeParse({
      duration_type: "MINUTES",
      duration_value: 31,
      max_darts_per_turn: 3,
    });
    expect(result.success).toBe(false);
  });
});

describe("TuodConfig bounds", () => {
  const validRest = {
    finish_bonus: 10,
    miss_penalty: 1,
    duration_type: "ROUNDS",
    duration_value: 10,
    max_darts_per_turn: 3,
  };

  it("rejects starting_target: 1, which no double can finish", () => {
    const result = TuodConfig.safeParse({ ...validRest, starting_target: 1 });
    expect(result.success).toBe(false);
  });

  it("accepts starting_target: 2, the minimum finishable double-out target", () => {
    const result = TuodConfig.safeParse({ ...validRest, starting_target: 2 });
    expect(result.success).toBe(true);
  });

  it("rejects a finish_bonus or miss_penalty that cannot move the ladder", () => {
    expect(
      TuodConfig.safeParse({
        ...validRest,
        starting_target: 41,
        finish_bonus: 0,
      }).success,
    ).toBe(false);
    expect(
      TuodConfig.safeParse({
        ...validRest,
        starting_target: 41,
        miss_penalty: 0,
      }).success,
    ).toBe(false);
  });

  it("rejects a visit longer than three darts", () => {
    const result = TuodConfig.safeParse({
      ...validRest,
      starting_target: 41,
      max_darts_per_turn: 4,
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
