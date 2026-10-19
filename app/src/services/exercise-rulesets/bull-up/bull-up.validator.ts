import { BullUpV1Config } from "@lib/training/exercises/rulesets/types";
import { makeConfigValidator } from "@services/exercise-rulesets/config-validator";

/**
 * Bull Up v1 asserts only that the config parses — the empty object; the
 * target is always the bull
 * (`docs/game-rules/training/exercises/bull-up-practice.md`).
 */
export const bullUpValidator = makeConfigValidator(BullUpV1Config);
