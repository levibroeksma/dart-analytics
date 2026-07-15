import { ERROR_HTTP, type ErrorCode } from "./errors";

const JSON_HEADERS = { "Content-Type": "application/json" };

/** Frozen success envelope (docs/architecture/06-API/00-Overview.md). */
export function ok(data: unknown, requestId: string, status = 200): Response {
  return new Response(JSON.stringify({ ok: true, data, requestId }), {
    status,
    headers: JSON_HEADERS,
  });
}

/** Frozen error envelope; status/message/retryable come from the registry. */
export function fail(
  code: ErrorCode,
  requestId: string,
  details: Record<string, unknown> = {},
): Response {
  const { status, message, retryable } = ERROR_HTTP[code];
  return new Response(
    JSON.stringify({ ok: false, error: { code, message, retryable, details }, requestId }),
    { status, headers: JSON_HEADERS },
  );
}
