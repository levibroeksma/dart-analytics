import type { ErrorCode } from "./types";

const TRANSIENT_PATTERNS =
  /fetch failed|network|econnreset|econnrefused|etimedout|timeout|connection|terminated|socket hang up|503|service unavailable|too many connections|could not connect/i;

/**
 * Classifies an uncaught error thrown while handling an API request into the
 * frozen registry code the middleware boundary returns. Transient
 * connectivity/database failures (recoverable by a client retry) map to
 * SERVICE_UNAVAILABLE; everything else is an INTERNAL_ERROR. Pattern-based on
 * purpose: a genuine bug must surface as a non-retryable 500, never a
 * retry-forever 503.
 */
export function classifyThrownError(
  error: unknown,
): Extract<ErrorCode, "SERVICE_UNAVAILABLE" | "INTERNAL_ERROR"> {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const name = error instanceof Error ? error.name : "";
  return TRANSIENT_PATTERNS.test(message) || TRANSIENT_PATTERNS.test(name)
    ? "SERVICE_UNAVAILABLE"
    : "INTERNAL_ERROR";
}
