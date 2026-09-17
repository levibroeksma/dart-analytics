import { ERROR_HTTP } from "./errors";
import type { ErrorCode } from "./types";

/**
 * Per-response headers. `X-Request-Id` carries the same id the body echoes, so
 * a failure can be correlated to its Worker log line by anything that reads
 * headers rather than parsing JSON — proxies, the devtools network pane, log
 * shippers (`06-API/03-Shared-Conventions.md` Header Contract, D300).
 */
function jsonHeaders(requestId: string): Record<string, string> {
  return { "Content-Type": "application/json", "X-Request-Id": requestId };
}

/** Frozen success envelope (docs/architecture/06-API/00-Overview.md). */
export function ok(data: unknown, requestId: string, status = 200): Response {
  return new Response(JSON.stringify({ ok: true, data, requestId }), {
    status,
    headers: jsonHeaders(requestId),
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
    JSON.stringify({
      ok: false,
      error: { code, message, retryable, details },
      requestId,
    }),
    { status, headers: jsonHeaders(requestId) },
  );
}
