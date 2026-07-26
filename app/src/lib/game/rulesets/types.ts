import { z } from "zod";

/**
 * Every ruleset schema is `.strict()`: an unrecognized key fails the parse
 * instead of being silently stripped, so a seeded preset that drifts from its
 * schema surfaces as a rejected session rather than quietly losing data.
 */
export const ScoreTrainingConfig = z
  .object({
    duration_type: z.enum(["ROUNDS", "MINUTES"]),
    duration_value: z.number().int().min(1),
    max_darts_per_turn: z.number().int().min(1).max(3),
    max_visit_score: z.number().int().default(180),
  })
  .strict();

export const Bobs27Config = z
  .object({
    start_score: z.number().int().default(27),
    bull_hit_value: z.number().int().default(50),
    miss_penalty_multiplier: z.number().int().default(1),
  })
  .strict();

export const SinglesConfig = z
  .object({
    order_mode: z.enum(["LOW_TO_HIGH"]),
    difficulty: z.enum(["EASY"]),
    points_single: z.number().int().default(1),
    points_double: z.number().int().default(2),
    points_treble: z.number().int().default(3),
  })
  .strict();

export const DoublesTrainingConfig = z
  .object({
    mode: z.enum(["EASY"]),
    order_mode: z.enum(["LOW_TO_HIGH"]),
  })
  .strict();

/**
 * `starting_score` has a floor of 2 — the minimum a double-out leg can ever
 * finish from (D1 = 2) — so a degenerate `startingScore: 0` config can never
 * validate. Without this floor, `record({ scoreAttempted: 0 })` reports
 * `IN_PROGRESS` (0 darts thrown yet), while a `state()` rehydrated from that
 * same starting score folds zero turns and reports `WON`, since the engine's
 * initial remaining score already equals zero.
 */
export const FiveOhOneConfig = z
  .object({
    starting_score: z.number().int().min(2).default(501),
    legs_to_win: z.number().int().min(1).max(20),
    check_in: z.enum(["STRAIGHT_IN"]),
    check_out: z.enum(["DOUBLE_OUT"]),
    max_darts_per_turn: z.number().int().min(1).max(3),
    max_visit_score: z.number().int().default(180),
  })
  .strict();

export type RulesetVersionKey =
  | "SCORE_TRAINING_V1"
  | "BOBS27_V1"
  | "SINGLES_V1"
  | "DOUBLES_TRAINING_V1"
  | "501_V1";

export const RULESET_CONFIGS: Record<RulesetVersionKey, z.ZodTypeAny> = {
  SCORE_TRAINING_V1: ScoreTrainingConfig,
  BOBS27_V1: Bobs27Config,
  SINGLES_V1: SinglesConfig,
  DOUBLES_TRAINING_V1: DoublesTrainingConfig,
  "501_V1": FiveOhOneConfig,
};

export type ScoreTrainingConfigData = z.infer<typeof ScoreTrainingConfig>;
export type Bobs27ConfigData = z.infer<typeof Bobs27Config>;
export type SinglesConfigData = z.infer<typeof SinglesConfig>;
export type DoublesTrainingConfigData = z.infer<typeof DoublesTrainingConfig>;
export type FiveOhOneConfigData = z.infer<typeof FiveOhOneConfig>;

export type ScoreTrainingSnapshot = {
  durationType: ScoreTrainingConfigData["duration_type"];
  durationValue: ScoreTrainingConfigData["duration_value"];
  maxDartsPerTurn: ScoreTrainingConfigData["max_darts_per_turn"];
  maxVisitScore: ScoreTrainingConfigData["max_visit_score"];
};

export type Bobs27Snapshot = {
  startScore: Bobs27ConfigData["start_score"];
  bullHitValue: Bobs27ConfigData["bull_hit_value"];
  missPenaltyMultiplier: Bobs27ConfigData["miss_penalty_multiplier"];
};

export type SinglesSnapshot = {
  orderMode: SinglesConfigData["order_mode"];
  difficulty: SinglesConfigData["difficulty"];
  pointsSingle: SinglesConfigData["points_single"];
  pointsDouble: SinglesConfigData["points_double"];
  pointsTreble: SinglesConfigData["points_treble"];
};

export type DoublesTrainingSnapshot = {
  mode: DoublesTrainingConfigData["mode"];
  orderMode: DoublesTrainingConfigData["order_mode"];
};

export type FiveOhOneSnapshot = {
  startingScore: FiveOhOneConfigData["starting_score"];
  legsToWin: FiveOhOneConfigData["legs_to_win"];
  checkIn: FiveOhOneConfigData["check_in"];
  checkOut: FiveOhOneConfigData["check_out"];
  maxDartsPerTurn: FiveOhOneConfigData["max_darts_per_turn"];
  maxVisitScore: FiveOhOneConfigData["max_visit_score"];
};

export type ConfigSnapshotFor<K extends RulesetVersionKey> =
  K extends "SCORE_TRAINING_V1"
    ? ScoreTrainingSnapshot
    : K extends "BOBS27_V1"
      ? Bobs27Snapshot
      : K extends "SINGLES_V1"
        ? SinglesSnapshot
        : K extends "DOUBLES_TRAINING_V1"
          ? DoublesTrainingSnapshot
          : FiveOhOneSnapshot;
