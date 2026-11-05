/**
 * `requestId` and `details` mirror the envelope's own fields (`ApiFailure`,
 * `client.ts`) so a generically-classified `INTERNAL_ERROR` — the server
 * logs its raw cause server-side only, never in the response body
 * (`middleware.ts`) — can still be traced back to that log line by
 * `requestId`, and a deliberately-returned `details.reason` isn't silently
 * dropped between the envelope and whatever displays this error.
 */
export class SessionApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "SessionApiError";
  }
}
