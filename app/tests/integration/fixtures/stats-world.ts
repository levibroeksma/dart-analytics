import { sql } from "drizzle-orm";
import type { GameTypeKey } from "@lib/types";
import { seedRoutineRun } from "./stats-routine";
import {
  CHECKOUT_170_SCRIPT,
  insertSession,
  UNIVERSAL_SCRIPT,
  uuid,
  type DartScript,
  type Db,
} from "./stats-world-sql";

export const FIXTURE_PLAYER = uuid(0xa0001);
const STANDALONE_ACTIVITY_ID = uuid(0xa0010);

export type StatsWorld = {
  playerId: string;
  gameSessions: Record<GameTypeKey, string>;
  routine: { routineKey: string; stepKinds: readonly string[] };
};

type GameFixture = {
  rulesetVersionKey: string;
  stageTypeKey: "LEG" | "ROUND" | "EXERCISE_BLOCK";
  configuration: Record<string, unknown>;
  script: DartScript;
};

const TARGET_ORDER_1_TO_20_THEN_BULL = [
  ...Array.from({ length: 20 }, (_, i) => i + 1),
  25,
];

/**
 * Spec §4.2: the highest seeded ruleset version per game, its stage type
 * (spec F11) and a wire-form config that satisfies its `.strict()` schema
 * (spec F12). `501` starts at 170 so `CHECKOUT_170_SCRIPT` finishes the leg
 * (spec F21). Typed `Record<GameTypeKey, …>` so a new game fails `tsc` until
 * it has a row here.
 */
export const GAME_FIXTURES: Record<GameTypeKey, GameFixture> = {
  "501": {
    rulesetVersionKey: "501_V1",
    stageTypeKey: "LEG",
    configuration: {
      starting_score: 170,
      legs_to_win: 1,
      check_in: "STRAIGHT_IN",
      check_out: "DOUBLE_OUT",
      max_darts_per_turn: 3,
      max_visit_score: 180,
    },
    script: CHECKOUT_170_SCRIPT,
  },
  TUOD: {
    rulesetVersionKey: "TUOD_V1",
    stageTypeKey: "EXERCISE_BLOCK",
    configuration: {
      starting_target: 10,
      finish_bonus: 1,
      miss_penalty: 1,
      duration_type: "ROUNDS",
      duration_value: 10,
      max_darts_per_turn: 3,
    },
    script: UNIVERSAL_SCRIPT,
  },
  ONE_TWENTY_ONE: {
    rulesetVersionKey: "121_V2",
    stageTypeKey: "ROUND",
    configuration: { duration_type: "ROUNDS", duration_value: 10 },
    script: UNIVERSAL_SCRIPT,
  },
  SCORE_TRAINING: {
    rulesetVersionKey: "SCORE_TRAINING_V1",
    stageTypeKey: "EXERCISE_BLOCK",
    configuration: {
      duration_type: "ROUNDS",
      duration_value: 10,
      max_darts_per_turn: 3,
      max_visit_score: 180,
    },
    script: UNIVERSAL_SCRIPT,
  },
  SINGLES_TRAINING: {
    rulesetVersionKey: "SINGLES_V3",
    stageTypeKey: "EXERCISE_BLOCK",
    configuration: {
      order_mode: "LOW_TO_HIGH",
      target_order: TARGET_ORDER_1_TO_20_THEN_BULL,
      difficulty: "EASY",
      scoring_mode: "STANDARD",
      points_single: 1,
      points_double: 2,
      points_treble: 3,
    },
    script: UNIVERSAL_SCRIPT,
  },
  DOUBLES_TRAINING: {
    rulesetVersionKey: "DOUBLES_TRAINING_V1",
    stageTypeKey: "EXERCISE_BLOCK",
    configuration: {
      mode: "EASY",
      order_mode: "LOW_TO_HIGH",
      target_order: TARGET_ORDER_1_TO_20_THEN_BULL,
    },
    script: UNIVERSAL_SCRIPT,
  },
  BOBS27: {
    rulesetVersionKey: "BOBS27_V1",
    stageTypeKey: "EXERCISE_BLOCK",
    configuration: {
      start_score: 27,
      bull_hit_value: 50,
      miss_penalty_multiplier: 1,
    },
    script: UNIVERSAL_SCRIPT,
  },
  SHANGHAI: {
    rulesetVersionKey: "SHANGHAI_V2",
    stageTypeKey: "EXERCISE_BLOCK",
    configuration: { difficulty: "NORMAL" },
    script: UNIVERSAL_SCRIPT,
  },
  AROUND_THE_CLOCK: {
    rulesetVersionKey: "AROUND_THE_CLOCK_V2",
    stageTypeKey: "EXERCISE_BLOCK",
    configuration: {
      path_direction: "LOW_TO_HIGH",
      odds_first: false,
      segment_rule: "ANY",
      difficulty: "EASY",
      duration_type: "UNTIMED",
      duration_value: null,
    },
    script: UNIVERSAL_SCRIPT,
  },
  CRICKET: {
    rulesetVersionKey: "CRICKET_V1",
    stageTypeKey: "EXERCISE_BLOCK",
    configuration: {},
    script: UNIVERSAL_SCRIPT,
  },
  TACTICS: {
    rulesetVersionKey: "TACTICS_V1",
    stageTypeKey: "EXERCISE_BLOCK",
    configuration: {},
    script: UNIVERSAL_SCRIPT,
  },
};

/**
 * Inserts the whole fixture world (spec §3–4) through the rolled-back
 * transaction `db`: the player, one standalone activity holding a completed
 * session per `GameTypeKey`, and one completed routine run. Never commits.
 */
export async function seedStatsWorld(db: Db): Promise<StatsWorld> {
  await db.execute(sql`
    INSERT INTO players (id, auth_user_id, display_name, created_at, updated_at)
    VALUES (${FIXTURE_PLAYER}::uuid, 'itest-stats-world', 'Stats World', now(), now())`);
  await db.execute(sql`
    INSERT INTO activities (id, player_id, status_id, started_at, completed_at, created_at)
    VALUES (${STANDALONE_ACTIVITY_ID}::uuid, ${FIXTURE_PLAYER}::uuid,
      (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
      now() - interval '1 hour', now(), now())`);

  const games = Object.keys(GAME_FIXTURES) as GameTypeKey[];
  const gameSessions = {} as Record<GameTypeKey, string>;
  for (const [index, game] of games.entries()) {
    const fixture = GAME_FIXTURES[game];
    gameSessions[game] = await insertSession(db, {
      base: 0xa1000 + index * 0x100,
      activityId: STANDALONE_ACTIVITY_ID,
      playerId: FIXTURE_PLAYER,
      exerciseTypeKey: "GAME",
      exerciseRulesetVersionKey: null,
      gameTypeKey: game,
      rulesetVersionKey: fixture.rulesetVersionKey,
      captured: true,
      routineStepSequenceNumber: null,
      configuration: fixture.configuration,
      play: { stageTypeKey: fixture.stageTypeKey, script: fixture.script },
    });
  }

  const routine = await seedRoutineRun(
    db,
    FIXTURE_PLAYER,
    GAME_FIXTURES["501"],
  );
  return { playerId: FIXTURE_PLAYER, gameSessions, routine };
}
