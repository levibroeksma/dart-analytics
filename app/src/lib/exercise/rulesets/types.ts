import { z } from "zod";

/**
 * Exercise ruleset versions, kept deliberately separate from the game
 * `RulesetVersionKey` union. `scripts/check-game-wiring.sh` requires every key
 * in `services/rulesets/registry.ts` to declare a capture/input mode pair and
 * game pages; an exercise ruleset has neither (09-training-routines.md §24).
 */
export type ExerciseRulesetVersionKey = "WARM_UP_V1";

/**
 * One timed section of a warm-up. `targets` are board numbers the player aims
 * at during the section; 25 is the bull. Nothing is recorded against them —
 * the warm-up takes no dart input (§16).
 */
export const WarmUpPhaseConfig = z
  .object({
    name: z.string().min(1).max(40),
    targets: z.array(z.number().int().min(1).max(25)).min(1).max(6),
    durationSeconds: z.number().int().min(1).max(3600),
  })
  .strict();

/**
 * Warm-Up v1: an ordered, non-empty list of timed phases and nothing else. The
 * upper phase bound is a sanity ceiling, not a product rule; the §7 sixty-minute
 * routine cap is enforced by `routine-duration.module.ts` across all steps.
 */
export const WarmUpV1Config = z
  .object({
    phases: z.array(WarmUpPhaseConfig).min(1).max(12),
  })
  .strict();

export type WarmUpConfigData = z.infer<typeof WarmUpV1Config>;

export const EXERCISE_RULESET_CONFIGS: Record<
  ExerciseRulesetVersionKey,
  z.ZodTypeAny
> = {
  WARM_UP_V1: WarmUpV1Config,
};
