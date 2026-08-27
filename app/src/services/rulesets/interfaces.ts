import type { ExistingTurnCounts } from "@repositories/interfaces";
import type { EventsBatchRequestInput } from "@routes/types";
import type { BatchValidationResult, ConfigValidationResult } from "./types";

export interface RulesetValidator {
  validateConfig(input: {
    config: unknown;
    captureModeKey: string;
    inputModeKey: string;
  }): ConfigValidationResult;

  /**
   * `captureModeKey`/`inputModeKey` are optional here because most rulesets
   * support exactly one mode pair and never branch on it in `validateBatch` —
   * only a ruleset that supports more than one pair (501, Score Training)
   * needs them to pick between a coordinate validator and a visit-total one.
   */
  validateBatch(input: {
    config: Record<string, unknown>;
    batch: EventsBatchRequestInput;
    existingTurnCounts: ExistingTurnCounts;
    captureModeKey?: string;
    inputModeKey?: string;
  }): BatchValidationResult;
}
