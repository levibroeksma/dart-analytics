import { describe, expect, it } from "vitest";
import {
  AroundTheClockConfig,
  BaseballConfig,
  KillerConfig,
  Bobs27Config,
  Bobs27V2Config,
  CricketConfig,
  TacticsConfig,
  AroundTheClockV2Config,
  AroundTheClockV3Config,
  FiveOhOneConfig,
  OneTwentyOneV2Config,
  RULESET_CONFIGS,
  ScoreTrainingConfig,
  ShanghaiV2Config,
  ShanghaiV3Config,
  SinglesConfig,
  SinglesV2Config,
  SinglesV3Config,
  TuodConfig,
} from "@lib/types";
import { toSnapshot } from "@lib/game/rulesets/config-codec";

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

  it("rejects duration_value: 0 for ROUNDS, one below the floor", () => {
    const result = TuodConfig.safeParse({
      ...validRest,
      starting_target: 41,
      duration_value: 0,
    });
    expect(result.success).toBe(false);
  });

  it("accepts duration_value: 100 for ROUNDS, the ceiling", () => {
    const result = TuodConfig.safeParse({
      ...validRest,
      starting_target: 41,
      duration_value: 100,
    });
    expect(result.success).toBe(true);
  });

  it("rejects duration_value: 101 for ROUNDS, one past the ceiling", () => {
    const result = TuodConfig.safeParse({
      ...validRest,
      starting_target: 41,
      duration_value: 101,
    });
    expect(result.success).toBe(false);
  });

  it("rejects duration_value: 2 for MINUTES, one below the floor", () => {
    const result = TuodConfig.safeParse({
      ...validRest,
      starting_target: 41,
      duration_type: "MINUTES",
      duration_value: 2,
    });
    expect(result.success).toBe(false);
  });

  it("accepts duration_value: 3 for MINUTES, the floor", () => {
    const result = TuodConfig.safeParse({
      ...validRest,
      starting_target: 41,
      duration_type: "MINUTES",
      duration_value: 3,
    });
    expect(result.success).toBe(true);
  });

  it("accepts duration_value: 30 for MINUTES, the ceiling", () => {
    const result = TuodConfig.safeParse({
      ...validRest,
      starting_target: 41,
      duration_type: "MINUTES",
      duration_value: 30,
    });
    expect(result.success).toBe(true);
  });

  it("rejects duration_value: 31 for MINUTES, one past the ceiling", () => {
    const result = TuodConfig.safeParse({
      ...validRest,
      starting_target: 41,
      duration_type: "MINUTES",
      duration_value: 31,
    });
    expect(result.success).toBe(false);
  });
});

describe("RULESET_CONFIGS strictness", () => {
  it("validates 501_V2 against the V2 schema, not the V1 one", () => {
    const v1Shaped = {
      starting_score: 501,
      legs_to_win: 1,
      check_in: "STRAIGHT_IN",
      check_out: "DOUBLE_OUT",
      max_darts_per_turn: 3,
    };
    expect(RULESET_CONFIGS["501_V2"].safeParse(v1Shaped).success).toBe(false);
    expect(RULESET_CONFIGS["501_V1"].safeParse(v1Shaped).success).toBe(true);
  });

  it("validates 501_V2 against the V2 schema, not the V1 one", () => {
    const v1Shaped = {
      starting_score: 501,
      legs_to_win: 1,
      check_in: "STRAIGHT_IN",
      check_out: "DOUBLE_OUT",
      max_darts_per_turn: 3,
    };
    expect(RULESET_CONFIGS["501_V2"].safeParse(v1Shaped).success).toBe(false);
    expect(RULESET_CONFIGS["501_V1"].safeParse(v1Shaped).success).toBe(true);
  });

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

describe("AroundTheClockConfig", () => {
  it("accepts an empty object", () => {
    const result = AroundTheClockConfig.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects any key (the schema is .strict())", () => {
    const result = AroundTheClockConfig.safeParse({ rounds: 20 });
    expect(result.success).toBe(false);
  });
});

describe("RULESET_CONFIGS", () => {
  it("registers AROUND_THE_CLOCK_V1", () => {
    expect(RULESET_CONFIGS.AROUND_THE_CLOCK_V1).toBe(AroundTheClockConfig);
  });

  it("registers CRICKET_V1", () => {
    expect(RULESET_CONFIGS.CRICKET_V1).toBe(CricketConfig);
  });

  it("registers CRICKET_V2 on the shared empty strict config", () => {
    expect(RULESET_CONFIGS.CRICKET_V2).toBe(CricketConfig);
    expect(CricketConfig.safeParse({}).success).toBe(true);
    expect(CricketConfig.safeParse({ mode: "X" }).success).toBe(false);
  });

  it("rejects any Cricket config key", () => {
    expect(CricketConfig.safeParse({ objectives: [20] }).success).toBe(false);
    expect(CricketConfig.safeParse({}).success).toBe(true);
  });

  it("registers TACTICS_V2 on the shared empty strict config", () => {
    expect(RULESET_CONFIGS.TACTICS_V2).toBe(TacticsConfig);
    expect(TacticsConfig.safeParse({}).success).toBe(true);
    expect(TacticsConfig.safeParse({ mode: "X" }).success).toBe(false);
  });

  it("registers TACTICS_V1", () => {
    expect(RULESET_CONFIGS.TACTICS_V1).toBe(TacticsConfig);
  });

  it("rejects any Tactics config key", () => {
    expect(TacticsConfig.safeParse({ rule: "STRICT" }).success).toBe(false);
    expect(TacticsConfig.safeParse({}).success).toBe(true);
  });
});

describe("OneTwentyOneV2Config", () => {
  it("accepts TARGET with no duration_value", () => {
    const result = OneTwentyOneV2Config.safeParse({ duration_type: "TARGET" });
    expect(result.success).toBe(true);
  });

  it("rejects TARGET carrying a duration_value", () => {
    const result = OneTwentyOneV2Config.safeParse({
      duration_type: "TARGET",
      duration_value: 10,
    });
    expect(result.success).toBe(false);
  });

  it("accepts ROUNDS at the bounds (1 and 50)", () => {
    expect(
      OneTwentyOneV2Config.safeParse({
        duration_type: "ROUNDS",
        duration_value: 1,
      }).success,
    ).toBe(true);
    expect(
      OneTwentyOneV2Config.safeParse({
        duration_type: "ROUNDS",
        duration_value: 50,
      }).success,
    ).toBe(true);
  });

  it("rejects ROUNDS outside 1..50", () => {
    expect(
      OneTwentyOneV2Config.safeParse({
        duration_type: "ROUNDS",
        duration_value: 0,
      }).success,
    ).toBe(false);
    expect(
      OneTwentyOneV2Config.safeParse({
        duration_type: "ROUNDS",
        duration_value: 51,
      }).success,
    ).toBe(false);
  });

  it("accepts MINUTES at the bounds (3 and 30)", () => {
    expect(
      OneTwentyOneV2Config.safeParse({
        duration_type: "MINUTES",
        duration_value: 3,
      }).success,
    ).toBe(true);
    expect(
      OneTwentyOneV2Config.safeParse({
        duration_type: "MINUTES",
        duration_value: 30,
      }).success,
    ).toBe(true);
  });

  it("rejects MINUTES outside 3..30", () => {
    expect(
      OneTwentyOneV2Config.safeParse({
        duration_type: "MINUTES",
        duration_value: 2,
      }).success,
    ).toBe(false);
    expect(
      OneTwentyOneV2Config.safeParse({
        duration_type: "MINUTES",
        duration_value: 31,
      }).success,
    ).toBe(false);
  });

  it("rejects ROUNDS/MINUTES with duration_value omitted", () => {
    expect(
      OneTwentyOneV2Config.safeParse({ duration_type: "ROUNDS" }).success,
    ).toBe(false);
  });

  it("rejects an unknown key (the schema is .strict())", () => {
    expect(
      OneTwentyOneV2Config.safeParse({
        duration_type: "TARGET",
        extra: 1,
      }).success,
    ).toBe(false);
  });
});

describe("RULESET_CONFIGS 121_V2", () => {
  it("registers 121_V2", () => {
    expect(RULESET_CONFIGS["121_V2"]).toBe(OneTwentyOneV2Config);
  });
});

describe("ShanghaiV2Config", () => {
  it("accepts NORMAL", () => {
    expect(ShanghaiV2Config.safeParse({ difficulty: "NORMAL" }).success).toBe(
      true,
    );
  });

  it("accepts HARD", () => {
    expect(ShanghaiV2Config.safeParse({ difficulty: "HARD" }).success).toBe(
      true,
    );
  });

  it("rejects an unrecognized difficulty value", () => {
    expect(
      ShanghaiV2Config.safeParse({ difficulty: "IMPOSSIBLE" }).success,
    ).toBe(false);
  });

  it("rejects a config missing difficulty", () => {
    expect(ShanghaiV2Config.safeParse({}).success).toBe(false);
  });

  it("rejects an unknown key (the schema is .strict())", () => {
    expect(
      ShanghaiV2Config.safeParse({ difficulty: "NORMAL", rounds: 7 }).success,
    ).toBe(false);
  });
});

describe("SinglesConfig difficulty", () => {
  const validRest = {
    order_mode: "LOW_TO_HIGH",
    target_order: [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
    ],
  };

  it("accepts EASY", () => {
    expect(
      SinglesConfig.safeParse({ ...validRest, difficulty: "EASY" }).success,
    ).toBe(true);
  });

  it("rejects HARD — a V1 config is never widened in place", () => {
    expect(
      SinglesConfig.safeParse({ ...validRest, difficulty: "HARD" }).success,
    ).toBe(false);
  });

  it("rejects an unrecognized difficulty value", () => {
    expect(
      SinglesConfig.safeParse({ ...validRest, difficulty: "PROFESSIONAL" })
        .success,
    ).toBe(false);
  });
});

describe("SinglesV2Config difficulty", () => {
  const validRest = {
    order_mode: "LOW_TO_HIGH",
    target_order: [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
    ],
  };

  it("accepts EASY", () => {
    expect(
      SinglesV2Config.safeParse({ ...validRest, difficulty: "EASY" }).success,
    ).toBe(true);
  });

  it("accepts HARD", () => {
    expect(
      SinglesV2Config.safeParse({ ...validRest, difficulty: "HARD" }).success,
    ).toBe(true);
  });

  it("accepts EXTREME", () => {
    expect(
      SinglesV2Config.safeParse({ ...validRest, difficulty: "EXTREME" })
        .success,
    ).toBe(true);
  });

  it("rejects an unrecognized difficulty value", () => {
    expect(
      SinglesV2Config.safeParse({ ...validRest, difficulty: "PROFESSIONAL" })
        .success,
    ).toBe(false);
  });
});

describe("SinglesV3Config scoring_mode", () => {
  const validRest = {
    order_mode: "LOW_TO_HIGH",
    target_order: [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
    ],
    difficulty: "EASY",
  };

  it("accepts STANDARD", () => {
    expect(
      SinglesV3Config.safeParse({ ...validRest, scoring_mode: "STANDARD" })
        .success,
    ).toBe(true);
  });

  it("accepts ACCURACY", () => {
    expect(
      SinglesV3Config.safeParse({ ...validRest, scoring_mode: "ACCURACY" })
        .success,
    ).toBe(true);
  });

  it("rejects an unrecognized scoring_mode value", () => {
    expect(
      SinglesV3Config.safeParse({ ...validRest, scoring_mode: "PRECISE" })
        .success,
    ).toBe(false);
  });
});

describe("RULESET_CONFIGS SHANGHAI_V2", () => {
  it("registers SHANGHAI_V2", () => {
    expect(RULESET_CONFIGS.SHANGHAI_V2).toBe(ShanghaiV2Config);
  });
});

describe("ShanghaiV3Config", () => {
  const valid = {
    difficulty: "NORMAL",
    range_start: 13,
    range_end: 20,
    instant_win: true,
  };

  it("registers SHANGHAI_V3", () => {
    expect(RULESET_CONFIGS.SHANGHAI_V3).toBe(ShanghaiV3Config);
  });

  it("accepts a valid range, a single-round range and the full board", () => {
    expect(ShanghaiV3Config.safeParse(valid).success).toBe(true);
    expect(
      ShanghaiV3Config.safeParse({ ...valid, range_start: 7, range_end: 7 })
        .success,
    ).toBe(true);
    expect(
      ShanghaiV3Config.safeParse({ ...valid, range_start: 1, range_end: 20 })
        .success,
    ).toBe(true);
  });

  it.each([
    ["start after end", { range_start: 8, range_end: 7 }],
    ["start below 1", { range_start: 0 }],
    ["end above 20", { range_end: 21 }],
    ["non-integer", { range_start: 1.5 }],
    ["unknown key", { extra: true }],
  ])("rejects %s", (_name, patch) => {
    expect(ShanghaiV3Config.safeParse({ ...valid, ...patch }).success).toBe(
      false,
    );
  });

  it.each(["difficulty", "range_start", "range_end", "instant_win"])(
    "rejects a missing %s",
    (key) => {
      const { [key]: _omit, ...rest } = valid as Record<string, unknown>;
      expect(ShanghaiV3Config.safeParse(rest).success).toBe(false);
    },
  );
});

describe("AroundTheClockV2Config", () => {
  const v2Base = {
    path_direction: "LOW_TO_HIGH",
    odds_first: false,
    segment_rule: "ANY",
    difficulty: "EASY",
    duration_type: "UNTIMED",
    duration_value: null,
  } as const;

  it("accepts the untimed default", () => {
    expect(AroundTheClockV2Config.safeParse(v2Base).success).toBe(true);
  });

  it("accepts MINUTES 3 and 30", () => {
    for (const v of [3, 30]) {
      expect(
        AroundTheClockV2Config.safeParse({
          ...v2Base,
          duration_type: "MINUTES",
          duration_value: v,
        }).success,
      ).toBe(true);
    }
  });

  it("rejects MINUTES 2, 31 and null", () => {
    for (const v of [2, 31, null]) {
      expect(
        AroundTheClockV2Config.safeParse({
          ...v2Base,
          duration_type: "MINUTES",
          duration_value: v,
        }).success,
      ).toBe(false);
    }
  });

  it("rejects UNTIMED carrying a value", () => {
    expect(
      AroundTheClockV2Config.safeParse({ ...v2Base, duration_value: 10 })
        .success,
    ).toBe(false);
  });

  it("rejects unknown keys and bad enums", () => {
    expect(
      AroundTheClockV2Config.safeParse({ ...v2Base, extra: 1 }).success,
    ).toBe(false);
    expect(
      AroundTheClockV2Config.safeParse({ ...v2Base, difficulty: "EXTREME" })
        .success,
    ).toBe(false);
  });

  it("is registered as AROUND_THE_CLOCK_V2", () => {
    expect(RULESET_CONFIGS.AROUND_THE_CLOCK_V2).toBe(AroundTheClockV2Config);
  });

  it("toSnapshot camel-cases every key", () => {
    expect(toSnapshot("AROUND_THE_CLOCK_V2", v2Base)).toEqual({
      pathDirection: "LOW_TO_HIGH",
      oddsFirst: false,
      segmentRule: "ANY",
      difficulty: "EASY",
      durationType: "UNTIMED",
      durationValue: null,
    });
  });
});

describe("BaseballConfig", () => {
  it("registers BASEBALL_V1", () => {
    expect(RULESET_CONFIGS.BASEBALL_V1).toBe(BaseballConfig);
  });

  it("accepts only the empty object", () => {
    expect(BaseballConfig.safeParse({}).success).toBe(true);
    expect(BaseballConfig.safeParse({ innings: 9 }).success).toBe(false);
  });
});

describe("AroundTheClockV3Config", () => {
  const v3Base = {
    path_direction: "LOW_TO_HIGH",
    odds_first: false,
    segment_rule: "ANY",
    difficulty: "EASY",
    duration_type: "UNTIMED",
    duration_value: null,
    lives: 3,
  } as const;
  const refuses = (over: Record<string, unknown>) =>
    AroundTheClockV3Config.safeParse({ ...v3Base, ...over }).success;

  it("accepts the V2 fields with lives 3 on Easy untimed", () => {
    expect(AroundTheClockV3Config.safeParse(v3Base).success).toBe(true);
  });

  it("refuses lives with HARD", () => {
    expect(refuses({ difficulty: "HARD" })).toBe(false);
  });

  it("refuses lives with a timed run", () => {
    expect(refuses({ duration_type: "MINUTES", duration_value: 10 })).toBe(
      false,
    );
  });

  it("refuses a duration_value", () => {
    expect(refuses({ duration_value: 5 })).toBe(false);
  });

  it("refuses lives 2", () => {
    expect(refuses({ lives: 2 })).toBe(false);
  });

  it("refuses a missing lives", () => {
    const { lives: _lives, ...rest } = v3Base;
    expect(AroundTheClockV3Config.safeParse(rest).success).toBe(false);
  });

  it("refuses an unknown key", () => {
    expect(refuses({ extra: 1 })).toBe(false);
  });

  it("keeps V2 untouched by the field extraction", () => {
    const { lives: _lives, ...v2Fields } = v3Base;
    expect(AroundTheClockV2Config.safeParse(v2Fields).success).toBe(true);
    expect(AroundTheClockV2Config.safeParse(v3Base).success).toBe(false);
  });
});

describe("Bobs27V2Config", () => {
  it("accepts the Easy mode and fills the V1 defaults", () => {
    expect(Bobs27V2Config.parse({ mode: "EASY" })).toEqual({
      mode: "EASY",
      start_score: 27,
      bull_hit_value: 50,
      miss_penalty_multiplier: 1,
    });
  });

  it("requires the mode", () => {
    expect(Bobs27V2Config.safeParse({}).success).toBe(false);
  });

  it("rejects any mode but EASY", () => {
    expect(Bobs27V2Config.safeParse({ mode: "HARD" }).success).toBe(false);
  });

  it("stays strict after extending V1", () => {
    expect(Bobs27V2Config.safeParse({ mode: "EASY", lives: 3 }).success).toBe(
      false,
    );
  });

  it("is the config registered for BOBS27_V2", () => {
    expect(RULESET_CONFIGS.BOBS27_V2).toBe(Bobs27V2Config);
  });

  it("leaves V1 refusing a mode key", () => {
    expect(Bobs27Config.safeParse({ mode: "EASY" }).success).toBe(false);
  });
});

describe("KillerConfig", () => {
  it("is KILLER_V1's schema", () => {
    expect(RULESET_CONFIGS.KILLER_V1).toBe(KillerConfig);
  });

  it("parses the seeded preset with no seat numbers yet", () => {
    expect(KillerConfig.parse({ lives: 3 })).toEqual({
      lives: 3,
      seat_numbers: [],
    });
  });

  it("locks three lives and numbers 1–20", () => {
    expect(KillerConfig.safeParse({ lives: 5 }).success).toBe(false);
    expect(
      KillerConfig.safeParse({ lives: 3, seat_numbers: [0, 12] }).success,
    ).toBe(false);
    expect(
      KillerConfig.safeParse({ lives: 3, seat_numbers: [5, 21] }).success,
    ).toBe(false);
    expect(
      KillerConfig.safeParse({ lives: 3, seat_numbers: [5, 12] }).success,
    ).toBe(true);
  });
});
