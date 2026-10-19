import { HitCountV1Config } from "@lib/training/exercises/rulesets/types";
import { makeConfigValidator } from "@services/exercise-rulesets/config-validator";

/**
 * Hit Count v1 asserts the target list and darts per target parse —
 * trebles, doubles or the bullseye, a positive multiple of three darts each
 * (`docs/game-rules/training/exercises/hit-count.md`).
 */
export const hitCountValidator = makeConfigValidator(HitCountV1Config);
