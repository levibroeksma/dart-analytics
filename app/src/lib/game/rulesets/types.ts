import { z } from "zod";

/**
 * Every ruleset schema is `.strict()`: an unrecognized key fails the parse
 * instead of being silently stripped, so a seeded preset that drifts from its
 * schema surfaces as a rejected session rather than quietly losing data.
 */
/**
 * `duration_value` is bounded by `duration_type`: a ROUNDS session tops out
 * at 100 rounds, a MINUTES session at 30 minutes (floor 3). The bound is
 * conditional so it cannot be expressed with `.min()`/`.max()` on the field
 * alone — it needs a whole-object refinement that reads `duration_type`
 * alongside `duration_value`.
 */
export const ScoreTrainingConfig = z
  .object({
    duration_type: z.enum(["ROUNDS", "MINUTES"]),
    duration_value: z.number().int().min(1),
    max_darts_per_turn: z.number().int().min(1).max(3),
    max_visit_score: z.number().int().default(180),
  })
  .strict()
  .superRefine((val, ctx) => {
    const [min, max] = val.duration_type === "ROUNDS" ? [1, 100] : [3, 30];
    if (val.duration_value < min || val.duration_value > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["duration_value"],
        message: `duration_value must be between ${min} and ${max} for ${val.duration_type}`,
      });
    }
  });

export const Bobs27Config = z
  .object({
    start_score: z.number().int().default(27),
    bull_hit_value: z.number().int().default(50),
    miss_penalty_multiplier: z.number().int().default(1),
  })
  .strict();

/**
 * `target_order` is the concrete, already-resolved 21-target sequence a
 * Singles/Doubles Training session actually plays — a permutation of the 20
 * numbered targets (1..20) and BULL (25, the same sentinel
 * `board-progression.module.ts` uses for the bull target). `order_mode`
 * only describes how it was produced (ascending, descending, or shuffled);
 * the array is what the engine reads. Resolved once client-side at session
 * creation (`lib/game/target-order.ts`) and copied into the immutable
 * config snapshot, so undo/resume can never reshuffle mid-session.
 *
 * The `.superRefine` validating it is declared inline on each exported
 * config schema, not factored into a shared sub-schema — mechanically
 * required, not a style choice: `scripts/check-refinement-coverage.sh`
 * attributes a `.superRefine(`/`.refine(` call to the nearest preceding
 * `export const NAME =`, so a refinement living on a non-exported helper
 * const would be silently misattributed to whatever export happens to
 * precede it in the file.
 */
const TARGET_ORDER_VALUES = new Set<number>([
  ...Array.from({ length: 20 }, (_, i) => i + 1),
  25,
]);

function isValidTargetOrder(value: number[]): boolean {
  if (value.length !== 21) return false;
  const seen = new Set(value);
  if (seen.size !== 21) return false;
  return value.every((n) => TARGET_ORDER_VALUES.has(n));
}

export const SinglesConfig = z
  .object({
    order_mode: z.enum(["LOW_TO_HIGH", "HIGH_TO_LOW", "RANDOM"]),
    target_order: z.array(z.number().int()).length(21),
    difficulty: z.enum(["EASY"]),
    points_single: z.number().int().default(1),
    points_double: z.number().int().default(2),
    points_treble: z.number().int().default(3),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (!isValidTargetOrder(val.target_order)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["target_order"],
        message:
          "target_order must contain each of 1..20 and 25 (BULL) exactly once",
      });
    }
  });

export const DoublesTrainingConfig = z
  .object({
    mode: z.enum(["EASY"]),
    order_mode: z.enum(["LOW_TO_HIGH", "HIGH_TO_LOW", "RANDOM"]),
    target_order: z.array(z.number().int()).length(21),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (!isValidTargetOrder(val.target_order)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["target_order"],
        message:
          "target_order must contain each of 1..20 and 25 (BULL) exactly once",
      });
    }
  });

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

/**
 * Ten Up One Down: a checkout ladder that climbs by `finish_bonus` on a
 * successful attempt and falls by `miss_penalty` on a failed one, played for a
 * `duration_type`/`duration_value` session exactly as Score Training is.
 *
 * `starting_target` shares `FiveOhOneConfig.starting_score`'s floor of 2, the
 * minimum a double-out attempt can ever finish from (D1 = 2). `finish_bonus`
 * and `miss_penalty` each have a floor of 1: a step of 0 would leave the ladder
 * frozen on one target, which is not the game. No key carries a default —
 * every one is present in both seeded presets, and defaulting a ladder step
 * would silently invent a rule the preset never stated.
 *
 * V1 models no ladder floor. Whether a failed attempt may drop the target below
 * the start score is an open question in
 * `docs/game-rules/rulesets/ten-up-one-down.md`, so no key expresses it yet.
 */
export const TuodConfig = z
  .object({
    starting_target: z.number().int().min(2),
    finish_bonus: z.number().int().min(1),
    miss_penalty: z.number().int().min(1),
    duration_type: z.enum(["ROUNDS", "MINUTES"]),
    duration_value: z.number().int().min(1),
    max_darts_per_turn: z.number().int().min(1).max(3),
  })
  .strict();

/**
 * Shanghai v1 locks every rule (round range, scoring, Shanghai instant-win)
 * with nothing left to configure — a genuinely empty `.strict()` object, not
 * a placeholder. A future version that adds a round-range or instant-win
 * toggle widens this schema then.
 */
export const ShanghaiConfig = z.object({}).strict();

export type RulesetVersionKey =
  | "SCORE_TRAINING_V1"
  | "BOBS27_V1"
  | "SINGLES_V1"
  | "DOUBLES_TRAINING_V1"
  | "501_V1"
  | "TUOD_V1"
  | "SHANGHAI_V1";

export const RULESET_CONFIGS: Record<RulesetVersionKey, z.ZodTypeAny> = {
  SCORE_TRAINING_V1: ScoreTrainingConfig,
  BOBS27_V1: Bobs27Config,
  SINGLES_V1: SinglesConfig,
  DOUBLES_TRAINING_V1: DoublesTrainingConfig,
  "501_V1": FiveOhOneConfig,
  TUOD_V1: TuodConfig,
  SHANGHAI_V1: ShanghaiConfig,
};

export type ScoreTrainingConfigData = z.infer<typeof ScoreTrainingConfig>;
export type Bobs27ConfigData = z.infer<typeof Bobs27Config>;
export type SinglesConfigData = z.infer<typeof SinglesConfig>;
export type DoublesTrainingConfigData = z.infer<typeof DoublesTrainingConfig>;
export type FiveOhOneConfigData = z.infer<typeof FiveOhOneConfig>;
export type TuodConfigData = z.infer<typeof TuodConfig>;
export type ShanghaiConfigData = z.infer<typeof ShanghaiConfig>;

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
  targetOrder: SinglesConfigData["target_order"];
  difficulty: SinglesConfigData["difficulty"];
  pointsSingle: SinglesConfigData["points_single"];
  pointsDouble: SinglesConfigData["points_double"];
  pointsTreble: SinglesConfigData["points_treble"];
};

export type DoublesTrainingSnapshot = {
  mode: DoublesTrainingConfigData["mode"];
  orderMode: DoublesTrainingConfigData["order_mode"];
  targetOrder: DoublesTrainingConfigData["target_order"];
};

export type FiveOhOneSnapshot = {
  startingScore: FiveOhOneConfigData["starting_score"];
  legsToWin: FiveOhOneConfigData["legs_to_win"];
  checkIn: FiveOhOneConfigData["check_in"];
  checkOut: FiveOhOneConfigData["check_out"];
  maxDartsPerTurn: FiveOhOneConfigData["max_darts_per_turn"];
  maxVisitScore: FiveOhOneConfigData["max_visit_score"];
};

export type TuodSnapshot = {
  startingTarget: TuodConfigData["starting_target"];
  finishBonus: TuodConfigData["finish_bonus"];
  missPenalty: TuodConfigData["miss_penalty"];
  durationType: TuodConfigData["duration_type"];
  durationValue: TuodConfigData["duration_value"];
  maxDartsPerTurn: TuodConfigData["max_darts_per_turn"];
};

/** Shanghai v1 has nothing to configure — no fields to carry. */
export type ShanghaiSnapshot = Record<string, never>;

export type ConfigSnapshotFor<K extends RulesetVersionKey> =
  K extends "SCORE_TRAINING_V1"
    ? ScoreTrainingSnapshot
    : K extends "BOBS27_V1"
      ? Bobs27Snapshot
      : K extends "SINGLES_V1"
        ? SinglesSnapshot
        : K extends "DOUBLES_TRAINING_V1"
          ? DoublesTrainingSnapshot
          : K extends "501_V1"
            ? FiveOhOneSnapshot
            : K extends "TUOD_V1"
              ? TuodSnapshot
              : ShanghaiSnapshot;

/**
 * One boundary probe: a complete, parseable config plus the label the contract
 * test reports it under.
 */
export type BoundaryProbe<TConfig extends Record<string, unknown>> = {
  readonly label: string;
  readonly config: TConfig;
};

/**
 * Every boundary one refined field must accept and must reject. `accept` and
 * `reject` are both required: a contract that only rejects proves nothing
 * about the values the schema is supposed to let through, and vice versa.
 */
export type RefinedFieldContract<TConfig extends Record<string, unknown>> = {
  readonly field: string;
  readonly accept: readonly BoundaryProbe<TConfig>[];
  readonly reject: readonly BoundaryProbe<TConfig>[];
};

/**
 * A single Zod issue as the contract test reads it — only the path matters,
 * since the test uses it to confirm a rejection was blamed on the field the
 * contract claims to cover rather than on some unrelated part of the config.
 */
export type RefinementIssue = {
  readonly path: readonly PropertyKey[];
};

export type RefinementParseResult =
  | { readonly success: true }
  | {
      readonly success: false;
      readonly error: { readonly issues: readonly RefinementIssue[] };
    };

/**
 * The only capability the contract test needs from a schema. Structural rather
 * than `z.ZodTypeAny` so a contract entry cannot smuggle in a loosely typed
 * stand-in that silently accepts everything.
 */
export type ParsableSchema = {
  safeParse(data: unknown): RefinementParseResult;
};

/**
 * One schema's refinement contract. `schemaName` is the export name in
 * `types.ts`; `scripts/check-refinement-coverage.sh` compares the set of names
 * declared here against the set of schemas that actually carry a
 * `.superRefine(`/`.refine(` there, and the contract test asserts `schema` is
 * the very export that name refers to.
 */
export type SchemaRefinementContract<
  TConfig extends Record<string, unknown> = Record<string, unknown>,
> = {
  readonly schemaName: string;
  readonly schema: ParsableSchema;
  readonly fields: readonly RefinedFieldContract<TConfig>[];
};

/** One capture/input mode combination a ruleset version's engine implements. */
export type ModePair = {
  captureModeKey: string;
  inputModeKey: string;
};

/** One game card on the games page, with the ruleset version that gates it. */
export type GameCardDescriptor = {
  rulesetVersionKey: RulesetVersionKey;
  href: string;
  title: string;
  caption: string;
};
