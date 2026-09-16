import type { BlockingSession } from "./types";

/**
 * The blocking game behind a rejected step start, or `null` when the failure
 * is something else — or when the conflict named no session the player can
 * act on. `uq_sessions_single_active` rejects the Finishing step's TUOD
 * session whenever an unfinished TUOD game already exists; the server answers
 * with `SESSION_ALREADY_ACTIVE` and that game's id and start time
 * (`services/training-session.service.ts`), which is everything the routine
 * needs to offer a resolution in place (issue #357).
 */
export function activeSessionConflict(error: unknown): BlockingSession | null {
  const { code, details } = (error ?? {}) as {
    code?: string;
    details?: { sessionId?: unknown; startedAt?: unknown };
  };
  if (code !== "SESSION_ALREADY_ACTIVE") return null;
  const sessionId = details?.sessionId;
  if (typeof sessionId !== "string") return null;
  const startedAt = details?.startedAt;
  return {
    sessionId,
    startedAt: typeof startedAt === "string" ? startedAt : null,
  };
}
