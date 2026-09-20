import { SessionApiError } from "./sessions";
import type { ApiResult } from "./types";

/**
 * Returns a success envelope's data, or throws it as a `SessionApiError`.
 * Shared by every `client/api/*` module past one call site.
 *
 * Lives beside `client.ts` rather than in it: `sessions.ts` owns
 * `SessionApiError` and imports `apiRequest`, so a `client.ts` that reached
 * for the error class closed an import cycle the fallow gate rejects.
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
