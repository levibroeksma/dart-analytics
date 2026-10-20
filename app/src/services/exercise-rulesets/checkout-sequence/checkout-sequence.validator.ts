import { CheckoutSequenceV1Config } from "@lib/training/exercises/rulesets/types";
import { makeConfigValidator } from "@services/exercise-rulesets/config-validator";

/**
 * Checkout Sequence v1 asserts only that the config parses — the Catch 40
 * range and dart limit
 * (`docs/game-rules/training/exercises/catch-40.md`).
 */
export const checkoutSequenceValidator = makeConfigValidator(
  CheckoutSequenceV1Config,
);
