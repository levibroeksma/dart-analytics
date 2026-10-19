import { SwitchbladeV1Config } from "@lib/training/exercises/rulesets/types";
import { makeConfigValidator } from "@services/exercise-rulesets/config-validator";

/**
 * SwitchBlade v1 asserts the config is empty — the path is fixed
 * (`docs/game-rules/training/exercises/switchblade.md`).
 */
export const switchbladeValidator = makeConfigValidator(SwitchbladeV1Config);
