import { SessionApiError } from "./session-api-error";
import type { ApiResult } from "./types";

/**
 * Returns a success envelope's data, or throws it as a `SessionApiError`.
 * Shared by every `client/api/*` module past one call site.
 *
 * Imports `SessionApiError` from its own module, so neither `sessions.ts`
 * nor `client.ts` sits on an import cycle with this helper.
 */
export function unwrapOrThrow<T>(result: ApiResult<T>): T {
  if (!result.ok) {
    throw new SessionApiError(
      result.error.code,
      result.error.message,
      result.requestId,
      result.error.details,
    );
  }
  return result.data;
}
