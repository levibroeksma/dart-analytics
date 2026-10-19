import { RandomCheckoutV1Config } from "@lib/training/exercises/rulesets/types";
import { makeConfigValidator } from "@services/exercise-rulesets/config-validator";

/**
 * Random Checkout v1 asserts only that the config parses — the 40-170 range
 * and the server-minted draw seed
 * (`docs/game-rules/training/exercises/random-checkout.md`).
 */
export const randomCheckoutValidator = makeConfigValidator(
  RandomCheckoutV1Config,
);
