import type { ExerciseRulesetValidator } from "./interfaces";
import { warmUpValidator } from "./warm-up/warm-up.validator";
import { switchingValidator } from "./switching/switching.validator";
import { doublePatternValidator } from "./double-pattern/double-pattern.validator";
import { targetScoringValidator } from "./target-scoring/target-scoring.validator";
import { switchingTargetScoringValidator } from "./switching-target-scoring/switching-target-scoring.validator";

const REGISTRY: Record<string, ExerciseRulesetValidator> = {
  WARM_UP_V1: warmUpValidator,
  SWITCHING_V1: switchingValidator,
  DOUBLE_PATTERN_V1: doublePatternValidator,
  TARGET_SCORING_V1: targetScoringValidator,
  SWITCHING_TARGET_SCORING_V1: switchingTargetScoringValidator,
};

export function getExerciseRulesetValidator(
  exerciseRulesetVersionKey: string,
): ExerciseRulesetValidator | undefined {
  return REGISTRY[exerciseRulesetVersionKey];
}

/**
 * The exercise rulesets whose engines write turns and darts, and so upload an
 * events batch (`POST /api/sessions/:id/events/batch`). `WARM_UP_V1` is
 * deliberately absent: it persists nothing but the session row itself
 * (09-Training/01-Routines.md §16), so a batch arriving for a Warm-Up session is
 * a client bug, not data to store.
 */
const DART_WRITING_RULESET_VERSION_KEYS = new Set([
  "SWITCHING_V1",
  "DOUBLE_PATTERN_V1",
  "TARGET_SCORING_V1",
  "SWITCHING_TARGET_SCORING_V1",
]);

export function exerciseRulesetWritesDarts(
  exerciseRulesetVersionKey: string | null,
): boolean {
  return (
    exerciseRulesetVersionKey !== null &&
    DART_WRITING_RULESET_VERSION_KEYS.has(exerciseRulesetVersionKey)
  );
}
