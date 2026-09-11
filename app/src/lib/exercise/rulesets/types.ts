import { z } from "zod";

/**
 * Exercise ruleset versions, kept deliberately separate from the game
 * `RulesetVersionKey` union. `scripts/check-game-wiring.sh` requires every
 * key in `services/rulesets/registry.ts` to declare a capture/input mode
 * pair and game pages; an exercise ruleset has neither
 * (09-training-routines.md §24).
 */
export type ExerciseRulesetVersionKey =
  "WARM_UP_V1" | "SWITCHING_V1" | "DOUBLE_PATTERN_V1";

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
 * anywhere else scores 0 ("outside", 09-training-routines.md §14/§17) —
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
 * `targets` (design spec 2026-09-11 §5.2).
 */
export const SwitchingV1Config = z
  .object({
    targets: z.array(z.number().int().min(1).max(25)).min(1).max(20),
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

export const EXERCISE_RULESET_CONFIGS: Record<
  ExerciseRulesetVersionKey,
  z.ZodTypeAny
> = {
  WARM_UP_V1: WarmUpV1Config,
  SWITCHING_V1: SwitchingV1Config,
  DOUBLE_PATTERN_V1: DoublePatternV1Config,
};
