import { describe, expect, it } from "vitest";
import { toSnapshot } from "@lib/game/rulesets/config-codec";
import type { RulesetVersionKey } from "@lib/types";

/**
 * Every `configuration_templates` preset seeded, copied verbatim from
 * `database/seeds/0002_default_templates.sql` and
 * `database/seeds/0003_game_engine_reference.sql`. Keeping this list in sync
 * with the seed files is what turns a future seed/schema divergence into a
 * failing test here instead of a session that will not start — which is
 * exactly what the two TUOD presets were until `TUOD_V1` gained a schema,
 * an engine and a validator.
 */
const SEEDED_PRESETS: ReadonlyArray<{
  readonly name: string;
  readonly rulesetVersionKey: RulesetVersionKey;
  readonly configuration: unknown;
}> = [
  {
    name: "501 — Quick Play",
    rulesetVersionKey: "501_V1",
    configuration: {
      starting_score: 501,
      legs_to_win: 1,
      check_in: "STRAIGHT_IN",
      check_out: "DOUBLE_OUT",
      max_darts_per_turn: 3,
      max_visit_score: 180,
    },
  },
  {
    name: "501 — Best of 5 Legs",
    rulesetVersionKey: "501_V1",
    configuration: {
      starting_score: 501,
      legs_to_win: 3,
      check_in: "STRAIGHT_IN",
      check_out: "DOUBLE_OUT",
      max_darts_per_turn: 3,
      max_visit_score: 180,
    },
  },
  {
    name: "Singles — Low to High, Easy",
    rulesetVersionKey: "SINGLES_V1",
    configuration: {
      order_mode: "LOW_TO_HIGH",
      difficulty: "EASY",
    },
  },
  {
    name: "Score Training — 10 Rounds",
    rulesetVersionKey: "SCORE_TRAINING_V1",
    configuration: {
      duration_type: "ROUNDS",
      duration_value: 10,
      max_darts_per_turn: 3,
    },
  },
  {
    name: "Score Training — 5 Minutes",
    rulesetVersionKey: "SCORE_TRAINING_V1",
    configuration: {
      duration_type: "MINUTES",
      duration_value: 5,
      max_darts_per_turn: 3,
    },
  },
  {
    name: "Bob's 27 — Standard",
    rulesetVersionKey: "BOBS27_V1",
    configuration: {
      start_score: 27,
      bull_hit_value: 50,
      miss_penalty_multiplier: 1,
    },
  },
  {
    name: "Doubles Training — Easy, Low to High",
    rulesetVersionKey: "DOUBLES_TRAINING_V1",
    configuration: {
      mode: "EASY",
      order_mode: "LOW_TO_HIGH",
    },
  },
  {
    name: "TUOD — 10 Rounds",
    rulesetVersionKey: "TUOD_V1",
    configuration: {
      starting_target: 41,
      finish_bonus: 10,
      miss_penalty: 1,
      duration_type: "ROUNDS",
      duration_value: 10,
      max_darts_per_turn: 3,
    },
  },
  {
    name: "TUOD — 10 Minutes",
    rulesetVersionKey: "TUOD_V1",
    configuration: {
      starting_target: 41,
      finish_bonus: 10,
      miss_penalty: 1,
      duration_type: "MINUTES",
      duration_value: 10,
      max_darts_per_turn: 3,
    },
  },
];

describe("seeded configuration_templates presets", () => {
  it("parses every seeded preset for its ruleset version", () => {
    for (const preset of SEEDED_PRESETS) {
      expect(() =>
        toSnapshot(preset.rulesetVersionKey, preset.configuration),
      ).not.toThrow();
    }
  });

  it("covers every RulesetVersionKey with a shipped engine", () => {
    const coveredKeys = new Set(
      SEEDED_PRESETS.map((preset) => preset.rulesetVersionKey),
    );
    const expectedKeys: RulesetVersionKey[] = [
      "501_V1",
      "SINGLES_V1",
      "SCORE_TRAINING_V1",
      "BOBS27_V1",
      "DOUBLES_TRAINING_V1",
      "TUOD_V1",
    ];
    for (const key of expectedKeys) {
      expect(coveredKeys.has(key)).toBe(true);
    }
  });
});
