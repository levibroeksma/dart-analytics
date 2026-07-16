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
