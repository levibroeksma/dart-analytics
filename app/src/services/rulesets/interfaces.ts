import type {
  BatchValidationInput,
  BatchValidationResult,
  ConfigValidationResult,
} from "./types";

export interface RulesetValidator {
  validateConfig(input: {
    config: unknown;
    captureModeKey: string;
    inputModeKey: string;
  }): ConfigValidationResult;

  validateBatch(input: BatchValidationInput): BatchValidationResult;
}
