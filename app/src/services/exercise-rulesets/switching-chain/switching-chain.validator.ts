import { SwitchingChainV1Config } from "@lib/training/exercises/rulesets/types";
import { makeConfigValidator } from "@services/exercise-rulesets/config-validator";

/**
 * Switching Chain v1 asserts only that the sequence parses — exactly three
 * distinct board targets, 1–20 or 25. Scoring is locked in the engine, and
 * the mode is carried by the `SWITCHING_CHAIN_V1` ruleset version key, so
 * the configuration never names it.
 */
export const switchingChainValidator = makeConfigValidator(
  SwitchingChainV1Config,
);
