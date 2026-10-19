import { SwitchingV1Config } from "@lib/training/exercises/rulesets/types";
import { makeConfigValidator } from "@services/exercise-rulesets/config-validator";

/**
 * Switching v1 asserts only that the target list and scoring parse: the
 * ruleset has no mode pair to cross-check and no dart rows to bound
 * (09-Training/01-Routines.md §17). The §7 sixty-minute cap spans a whole
 * routine, so it belongs to `modules/training/routine-duration.module.ts`,
 * not here.
 */
export const switchingValidator = makeConfigValidator(SwitchingV1Config);
