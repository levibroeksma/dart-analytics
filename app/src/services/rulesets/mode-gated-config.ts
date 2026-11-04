import type { ZodTypeAny } from "zod";
import type { ConfigValidationResult } from "@services/types";

/**
 * The `validateConfig` body every mode-gated ruleset shares: reject with
 * `unsupportedIssue` when the session's mode pair is not one the ruleset
 * implements, else parse `config` against `schema` — returning its Zod
 * issues, or the parsed config with schema defaults applied. The issue string
 * is the caller's, because it crosses the API boundary verbatim.
 */
export function validateModeGatedConfig(
  schema: ZodTypeAny,
  config: unknown,
  modeSupported: boolean,
  unsupportedIssue: string,
): ConfigValidationResult {
  if (!modeSupported) {
    return { valid: false, issues: [unsupportedIssue] };
  }
  const parsed = schema.safeParse(config);
  if (!parsed.success) {
    return { valid: false, issues: parsed.error.issues };
  }
  return { valid: true, config: parsed.data };
}
