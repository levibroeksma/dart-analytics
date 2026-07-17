import type { z } from "zod";
import { fail } from "./envelope";

/**
 * Parses a raw request body into an `unknown` JSON value.
 * An empty (whitespace-only) body resolves to `{}`. Malformed JSON is
 * reported via `ok: false` rather than throwing.
 */
export function parseJsonBody(raw: string): { ok: true; value: unknown } | { ok: false } {
  if (raw.trim().length === 0) {
    return { ok: true, value: {} };
  }
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

/**
 * Parses a request body as JSON and validates it against a Zod schema,
 * building the standard `VALIDATION_FAILED` envelope on either failure.
 * Route handlers collapse the parse-body/validate-body/fail boilerplate to:
 *
 * ```ts
 * const parsed = await parseAndValidateBody(SomeRequest, request, locals.requestId);
 * if (!parsed.ok) return parsed.response;
 * // use parsed.data
 * ```
 */
export async function parseAndValidateBody<T extends z.ZodTypeAny>(
  schema: T,
  request: Request,
  requestId: string,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: Response }> {
  const parsedBody = parseJsonBody(await request.text());
  if (!parsedBody.ok) {
    return { ok: false, response: fail("VALIDATION_FAILED", requestId, { reason: "body is not valid JSON" }) };
  }

  const parsed = schema.safeParse(parsedBody.value);
  if (!parsed.success) {
    return { ok: false, response: fail("VALIDATION_FAILED", requestId, { issues: parsed.error.issues }) };
  }

  return { ok: true, data: parsed.data };
}
