import type { z } from "zod";
import type { ExerciseRulesetValidator } from "./interfaces";

/**
 * A validator that asserts only that the configuration snapshot parses
 * against `schema`: each failure becomes one `path: message` issue, and the
 * accepted config is the schema's output.
 */
export function makeConfigValidator(
  schema: z.ZodType,
): ExerciseRulesetValidator {
  return {
    validateConfig({ config }) {
      const parsed = schema.safeParse(config);
      if (!parsed.success) {
        return {
          ok: false,
          issues: parsed.error.issues.map(
            (issue) => `${issue.path.join(".")}: ${issue.message}`,
          ),
        };
      }
      return { ok: true, config: parsed.data as Record<string, unknown> };
    },
  };
}
