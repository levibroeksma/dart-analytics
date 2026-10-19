import { BullseyeCheckoutV1Config } from "@lib/training/exercises/rulesets/types";
import { makeConfigValidator } from "@services/exercise-rulesets/config-validator";

/**
 * Bullseye Checkout v1 asserts only that the config parses — a start score
 * of 81, the one value V1 accepts
 * (`docs/game-rules/training/exercises/bullseye-checkout.md`).
 */
export const bullseyeCheckoutValidator = makeConfigValidator(
  BullseyeCheckoutV1Config,
);
