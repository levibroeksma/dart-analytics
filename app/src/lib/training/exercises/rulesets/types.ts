import { z } from "zod";

/**
 * Exercise ruleset versions, kept deliberately separate from the game
 * `RulesetVersionKey` union. `scripts/check-game-wiring.sh` requires every
 * key in `services/rulesets/registry.ts` to declare a capture/input mode
 * pair and game pages; an exercise ruleset has neither
 * (09-Training/01-Routines.md §24).
 */
export type ExerciseRulesetVersionKey =
  | "WARM_UP_V1"
  | "SWITCHING_V1"
  | "DOUBLE_PATTERN_V1"
  | "TARGET_SCORING_V1"
  | "SWITCHING_TARGET_SCORING_V1"
  | "SCORE_THRESHOLD_V1"
  | "BULLSEYE_CHECKOUT_V1"
  | "BULL_UP_V1";

/**
 * One timed section of a warm-up. `targets` are board numbers the player
 * aims at during the section; 25 is the bull. Nothing is recorded against
 * them — the warm-up takes no dart input (§16). `weight` is proportional,
 * not absolute: the engine resolves each phase's actual duration from the
 * routine step's own total duration at construction time
 * (`WarmUpEngine.deriveState()`), which is what lets the same template serve
 * routines of different lengths (design spec 2026-09-11 §5.1).
 */
export const WarmUpPhaseConfig = z
  .object({
    name: z.string().min(1).max(40),
    targets: z.array(z.number().int().min(1).max(25)).min(1).max(6),
    weight: z.number().positive().max(100),
  })
  .strict();

/**
 * Warm-Up v1: an ordered, non-empty list of timed phases and nothing else.
 * The upper phase bound is a sanity ceiling, not a product rule; the §7
 * sixty-minute routine cap is enforced by `routine-duration.module.ts`
 * across all steps. This is the *template* shape — what is validated at
 * rest in `exercise_templates.default_configuration` and by
 * `warmUpValidator`. `WarmUpEngineInputSchema` below is the engine's own
 * construction-time input, which additionally needs the step's actual
 * duration.
 */
export const WarmUpV1Config = z
  .object({
    phases: z.array(WarmUpPhaseConfig).min(1).max(12),
  })
  .strict();

export type WarmUpConfigData = z.infer<typeof WarmUpV1Config>;

/**
 * What `warmUpEngineFactory.create()` actually takes: the template's phases
 * plus the routine step's own total duration, in seconds — structural data
 * that lives in `routine_steps.duration_type_id`/`duration_value`, never in
 * the template's own JSONB (migration 0028's own comment). Not part of
 * `EXERCISE_RULESET_CONFIGS`: that registry validates what is stored or
 * submitted as template configuration, and `stepDurationSeconds` is neither.
 */
export const WarmUpEngineInputSchema = z
  .object({
    phases: z.array(WarmUpPhaseConfig).min(1).max(12),
    stepDurationSeconds: z.number().int().min(1).max(3600),
  })
  .strict();

export type WarmUpEngineInput = z.infer<typeof WarmUpEngineInputSchema>;

/**
 * Per-zone points for one Switching target: a dart that lands on the
 * intended target number scores by which ring it hit; a dart landing
 * anywhere else scores 0 ("outside", 09-Training/01-Routines.md §14/§17) —
 * there is deliberately no `outside` key, since it is not a configurable
 * value.
 */
export const SwitchingScoringConfig = z
  .object({
    single: z.number().int().min(0).max(100),
    double: z.number().int().min(0).max(100),
    treble: z.number().int().min(0).max(100),
  })
  .strict();

/**
 * Switching v1: a fixed, ordered list of board-number targets, cycled dart
 * by dart for the step's full duration — one visit is one full pass through
 * `targets` (design spec 2026-09-11 §5.2). Targets stop at 20: the bull is
 * not a Switching target, because every dart is aimed at its target's
 * treble (`INTENDED_ZONE_KEY`, 09-Training/01-Routines.md §17) and the bull has
 * none (D297). Warm-Up's own targets still admit 25 — it aims at no ring.
 */
export const SwitchingV1Config = z
  .object({
    targets: z.array(z.number().int().min(1).max(20)).min(1).max(20),
    scoring: SwitchingScoringConfig,
  })
  .strict();

export type SwitchingConfigData = z.infer<typeof SwitchingV1Config>;

/**
 * Double Pattern v1: a fixed, ordered list of double-number patterns
 * (`D20`, not `20`), cycled pattern by pattern for the step's full duration.
 * One visit is one pattern; each pattern's own length is how many darts
 * that visit throws. Every hit double scores 1 point, nothing else scores
 * (design spec 2026-09-11 §5.3) — there is no configurable scoring, unlike
 * Switching.
 */
export const DoublePatternV1Config = z
  .object({
    patterns: z
      .array(z.array(z.number().int().min(1).max(20)).min(1).max(3))
      .min(1)
      .max(12),
  })
  .strict();

export type DoublePatternConfigData = z.infer<typeof DoublePatternV1Config>;

/** The bull's board number — the only legal target above 20. */
const BULL_TARGET_NUMBER = 25;

/**
 * Target Scoring v1: an ordered list of distinct board targets — any of
 * 1–20 and the bull (25) — worked one at a time, chain by chain, for the
 * step's full duration (`docs/game-rules/training/exercises/target-scoring.md`).
 * Scoring is locked by the rules (single 1, treble 3, outer bull 1,
 * bullseye 3, double a miss), so it lives in the engine, not here.
 */
const BoardTarget = z
  .number()
  .int()
  .min(1)
  .max(BULL_TARGET_NUMBER)
  .refine((n) => n <= 20 || n === BULL_TARGET_NUMBER, {
    message: "must be 1–20 or 25",
  });

function distinctTargets(targets: number[]): boolean {
  return new Set(targets).size === targets.length;
}

export const TargetScoringV1Config = z
  .object({
    targets: z
      .array(BoardTarget)
      .min(1)
      .max(21)
      .refine(distinctTargets, { message: "targets must not repeat" }),
  })
  .strict();

export type TargetScoringConfigData = z.infer<typeof TargetScoringV1Config>;

/**
 * Switching Target Scoring v1: exactly three distinct board targets, hit in
 * order and over again — a hit advances, a miss restarts at the first
 * (`docs/game-rules/training/exercises/switching-target-scoring.md`).
 * Scoring is Target Scoring's locked table, so it lives in the engine.
 */
export const SwitchingTargetScoringV1Config = z
  .object({
    targets: z
      .array(BoardTarget)
      .length(3)
      .refine(distinctTargets, { message: "targets must not repeat" }),
  })
  .strict();

export type SwitchingTargetScoringConfigData = z.infer<
  typeof SwitchingTargetScoringV1Config
>;

/**
 * Score Threshold v1 ("65 or More"): a visit beats when its board total
 * reaches the threshold
 * (`docs/game-rules/training/exercises/score-threshold.md`). V1 accepts 65
 * only; the threshold still lives here so a later ruleset widens the
 * number without a new exercise type.
 */
export const ScoreThresholdV1Config = z
  .object({
    threshold: z.literal(65),
  })
  .strict();

export type ScoreThresholdConfigData = z.infer<typeof ScoreThresholdV1Config>;

/**
 * Bullseye Checkout v1 ("Bullseye Checkouts"): every visit starts at
 * `startScore`; a checkout is a setup of `startScore − 50` on darts 1–2 and
 * the inner bull on dart 3
 * (`docs/game-rules/training/exercises/bullseye-checkout.md`). V1 accepts
 * 81 only; the start score still lives here so a later ruleset widens the
 * number without a new exercise type.
 */
export const BullseyeCheckoutV1Config = z
  .object({
    startScore: z.literal(81),
  })
  .strict();

export type BullseyeCheckoutConfigData = z.infer<
  typeof BullseyeCheckoutV1Config
>;

/**
 * Bull Up v1 ("Bull Up Practice"): one dart per throw, always at the bull
 * (`docs/game-rules/training/exercises/bull-up-practice.md`). Nothing is
 * configurable — duration is the routine step's — so the config is the
 * empty object.
 */
export const BullUpV1Config = z.object({}).strict();

export type BullUpConfigData = z.infer<typeof BullUpV1Config>;

export const EXERCISE_RULESET_CONFIGS: Record<
  ExerciseRulesetVersionKey,
  z.ZodTypeAny
> = {
  WARM_UP_V1: WarmUpV1Config,
  SWITCHING_V1: SwitchingV1Config,
  DOUBLE_PATTERN_V1: DoublePatternV1Config,
  TARGET_SCORING_V1: TargetScoringV1Config,
  SWITCHING_TARGET_SCORING_V1: SwitchingTargetScoringV1Config,
  SCORE_THRESHOLD_V1: ScoreThresholdV1Config,
  BULLSEYE_CHECKOUT_V1: BullseyeCheckoutV1Config,
  BULL_UP_V1: BullUpV1Config,
};
