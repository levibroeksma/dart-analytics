import type { EventsBatchRequestInput } from "@routes/types";
import type { BatchValidationResult, ConfigValidationResult } from "./types";

export interface RulesetValidator {
  validateConfig(input: {
    config: unknown;
    captureModeKey: string;
    inputModeKey: string;
  }): ConfigValidationResult;

  validateBatch(input: {
    config: Record<string, unknown>;
    batch: EventsBatchRequestInput;
    existingTurnCount: number;
  }): BatchValidationResult;
}
