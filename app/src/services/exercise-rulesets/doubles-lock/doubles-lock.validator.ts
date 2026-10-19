import { DoublesLockV1Config } from "@lib/training/exercises/rulesets/types";
import { makeConfigValidator } from "@services/exercise-rulesets/config-validator";

/**
 * Doubles Lock v1 asserts the config is empty — path, lock threshold and
 * bonus are fixed (`docs/game-rules/training/exercises/doubles-lock.md`).
 */
export const doublesLockValidator = makeConfigValidator(DoublesLockV1Config);
