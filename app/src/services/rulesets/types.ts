export type ConfigValidationResult =
  | { valid: true; config: Record<string, unknown> }
  | { valid: false; issues: unknown };

export type BatchValidationResult =
  | { valid: true }
  | {
      valid: false;
      code: "VALIDATION_FAILED" | "BATCH_INCONSISTENT_ORDERING" | "BATCH_REFERENCE_MISSING";
      issues?: unknown;
    };
