import { WarmUpV1Config } from "@lib/training/exercises/rulesets/types";
import { makeConfigValidator } from "@services/exercise-rulesets/config-validator";

/**
 * Warm-Up v1 asserts only that the phase list parses: the ruleset has no mode
 * pair to cross-check and no dart rows to bound (09-Training/01-Routines.md §16).
 * The §7 sixty-minute cap spans a whole routine, so it belongs to
 * `modules/training/routine-duration.module.ts`, not here.
 */
export const warmUpValidator = makeConfigValidator(WarmUpV1Config);
