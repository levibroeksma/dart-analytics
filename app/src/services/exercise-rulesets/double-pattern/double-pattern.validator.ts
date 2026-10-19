import { DoublePatternV1Config } from "@lib/training/exercises/rulesets/types";
import { makeConfigValidator } from "@services/exercise-rulesets/config-validator";

/**
 * Double Pattern v1 asserts only that the pattern list parses — no mode
 * pair, no dart rows to bound (09-Training/01-Routines.md §17). The §7
 * sixty-minute cap spans a whole routine, handled elsewhere.
 */
export const doublePatternValidator = makeConfigValidator(
  DoublePatternV1Config,
);
