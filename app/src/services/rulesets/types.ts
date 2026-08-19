import type { ZodTypeAny } from "zod";

export type ConfigValidationResult =
  | { valid: true; config: Record<string, unknown> }
  | { valid: false; issues: unknown };

export type BatchValidationResult =
  | { valid: true }
  | {
      valid: false;
      code:
        | "VALIDATION_FAILED"
        | "BATCH_INCONSISTENT_ORDERING"
        | "BATCH_REFERENCE_MISSING";
      issues?: unknown;
    };

/**
 * What `createThreeDartValidator` needs to know about one ruleset. Three
 * fields, because measurement found exactly three things the five three-dart
 * validators differ in: the Zod config schema, the game's name in the
 * mode-pair rejection, and the dartless-turn message.
 *
 * `dartlessIssue` is required rather than defaulted on purpose. The five ship
 * three distinct message bodies — Around the Clock names the two supported
 * mode pairs (a BULL hit can end a visit before three darts), Doubles
 * Training says "carries at least one dart", the rest say "is exactly 3
 * darts" — and these strings cross the API boundary to the client, so a
 * default would silently reword two of them.
 */
export type ThreeDartValidatorOptions = {
  label: string;
  configSchema: ZodTypeAny;
  dartlessIssue: (clientKey: string) => string;
};
