import { describe, expect, it } from "vitest";
import {
  DoublesTrainingConfig,
  FiveOhOneConfig,
  FiveOhOneV2Config,
  ScoreTrainingConfig,
  SinglesConfig,
  SinglesV2Config,
  SinglesV3Config,
  TuodConfig,
} from "@lib/game/rulesets/types";

const TARGET_ORDER = [...Array.from({ length: 20 }, (_, i) => i + 1), 25];

const CASES = [
  {
    name: "ScoreTrainingConfig",
    schema: ScoreTrainingConfig,
    input: {
      duration_type: "ROUNDS",
      duration_value: 10,
      max_darts_per_turn: 3,
    },
    keys: [
      "duration_type",
      "duration_value",
      "max_darts_per_turn",
      "max_visit_score",
    ],
  },
  {
    name: "TuodConfig",
    schema: TuodConfig,
    input: {
      starting_target: 10,
      finish_bonus: 10,
      miss_penalty: 1,
      duration_type: "ROUNDS",
      duration_value: 10,
      max_darts_per_turn: 3,
    },
    keys: [
      "starting_target",
      "finish_bonus",
      "miss_penalty",
      "duration_type",
      "duration_value",
      "max_darts_per_turn",
    ],
  },
  {
    name: "SinglesV2Config",
    schema: SinglesV2Config,
    input: {
      order_mode: "LOW_TO_HIGH",
      target_order: TARGET_ORDER,
      difficulty: "HARD",
    },
    keys: [
      "order_mode",
      "target_order",
      "difficulty",
      "points_single",
      "points_double",
      "points_treble",
    ],
  },
  {
    name: "SinglesV3Config",
    schema: SinglesV3Config,
    input: {
      order_mode: "LOW_TO_HIGH",
      target_order: TARGET_ORDER,
      difficulty: "EXTREME",
      scoring_mode: "ACCURACY",
    },
    keys: [
      "order_mode",
      "target_order",
      "difficulty",
      "scoring_mode",
      "points_single",
      "points_double",
      "points_treble",
    ],
  },
  {
    name: "FiveOhOneConfig",
    schema: FiveOhOneConfig,
    input: {
      legs_to_win: 1,
      check_in: "STRAIGHT_IN",
      check_out: "DOUBLE_OUT",
      max_darts_per_turn: 3,
    },
    keys: [
      "starting_score",
      "legs_to_win",
      "check_in",
      "check_out",
      "max_darts_per_turn",
      "max_visit_score",
    ],
  },
  {
    name: "FiveOhOneV2Config",
    schema: FiveOhOneV2Config,
    input: {
      check_in: "STRAIGHT_IN",
      check_out: "DOUBLE_OUT",
      max_darts_per_turn: 3,
      legs: { mode: "FIRST_TO", count: 3 },
      sets: null,
      win_by_two: null,
    },
    keys: [
      "starting_score",
      "check_in",
      "check_out",
      "max_darts_per_turn",
      "max_visit_score",
      "legs",
      "sets",
      "win_by_two",
    ],
  },
] as const;

describe("ruleset config schema shape", () => {
  it.each(CASES)("$name parses a minimal config in key order", (c) => {
    const result = c.schema.safeParse(c.input);
    expect(result.success).toBe(true);
    expect(Object.keys(result.data ?? {})).toEqual(c.keys);
  });

  it.each(CASES)("$name rejects an unknown key", (c) => {
    const result = c.schema.safeParse({ ...c.input, extra: 1 });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.code)).toContain(
      "unrecognized_keys",
    );
  });

  const durationCases = CASES.filter(
    (c) => c.name === "ScoreTrainingConfig" || c.name === "TuodConfig",
  );

  it.each(
    durationCases.flatMap((c) => [
      { ...c, type: "ROUNDS", value: 101, min: 1, max: 100 },
      { ...c, type: "MINUTES", value: 2, min: 3, max: 30 },
      { ...c, type: "MINUTES", value: 31, min: 3, max: 30 },
    ]),
  )(
    "$name rejects duration_value $value for $type with the bound message",
    (c) => {
      const result = c.schema.safeParse({
        ...c.input,
        duration_type: c.type,
        duration_value: c.value,
      });
      expect(result.success).toBe(false);
      expect(
        result.error?.issues.map((i) => ({ path: i.path, message: i.message })),
      ).toEqual([
        {
          path: ["duration_value"],
          message: `duration_value must be between ${c.min} and ${c.max} for ${c.type}`,
        },
      ]);
    },
  );
});

describe("target_order refinement", () => {
  const order = [...TARGET_ORDER.slice(0, 20), 1];

  it.each([
    {
      name: "SinglesConfig",
      schema: SinglesConfig,
      input: { order_mode: "RANDOM", target_order: order, difficulty: "EASY" },
    },
    {
      name: "SinglesV2Config",
      schema: SinglesV2Config,
      input: { order_mode: "RANDOM", target_order: order, difficulty: "HARD" },
    },
    {
      name: "SinglesV3Config",
      schema: SinglesV3Config,
      input: {
        order_mode: "RANDOM",
        target_order: order,
        difficulty: "HARD",
        scoring_mode: "STANDARD",
      },
    },
    {
      name: "DoublesTrainingConfig",
      schema: DoublesTrainingConfig,
      input: { mode: "EASY", order_mode: "RANDOM", target_order: order },
    },
  ])("$name rejects a non-permutation with the target_order message", (c) => {
    const result = c.schema.safeParse(c.input);
    expect(result.success).toBe(false);
    expect(
      result.error?.issues.map((i) => ({ path: i.path, message: i.message })),
    ).toEqual([
      {
        path: ["target_order"],
        message:
          "target_order must contain each of 1..20 and 25 (BULL) exactly once",
      },
    ]);
  });
});
