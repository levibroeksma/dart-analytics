import { completeSession, type SessionActiveData } from "@client/api/sessions";

interface StoreLike {
  reset(): void;
}

/**
 * Shared D88 reconciliation decision table (identical on setup and play, and
 * across every game). The only implementation — each game's setup and play
 * data factories import this directly and pass their own `gameTypeKey`, so a
 * session belonging to another game is never matched or abandoned here.
 *
 * "match": server ACTIVE session's sessionId equals local; caller resumes
 *   (setup: Continue/Abandon modal; play: keep store, hasActiveSession = true).
 *   Store is left untouched.
 * "no_active": no server ACTIVE session for this game type, or a mismatch that
 *   was successfully auto-abandoned. Store has already been reset by this
 *   function.
 * "abandon_failed": mismatch found but the auto-abandon PATCH failed. Store is
 *   NOT touched. Caller must block session creation and offer retry — never
 *   treat this the same as "no_active". The orphan is still ACTIVE server-side,
 *   so creating a session now would violate uq_sessions_single_active.
 *
 * @param gameTypeKey - The game whose ACTIVE session this caller owns; server
 *   sessions for any other game type are ignored entirely.
 */
export async function reconcileActiveSession(
  gameTypeKey: string,
  localSessionId: string | null,
  serverSessions: SessionActiveData[],
  store: StoreLike,
): Promise<{
  action: "match" | "no_active" | "abandon_failed";
  activeSession: SessionActiveData | null;
}> {
  const serverActive = serverSessions.find(
    (s) => s.gameTypeKey === gameTypeKey,
  );

  if (
    localSessionId &&
    serverActive &&
    serverActive.sessionId === localSessionId
  ) {
    return { action: "match", activeSession: serverActive };
  }

  if (
    serverActive &&
    (!localSessionId || serverActive.sessionId !== localSessionId)
  ) {
    try {
      await completeSession(serverActive.sessionId, "ABANDONED");
    } catch {
      return { action: "abandon_failed", activeSession: null };
    }
    store.reset();
    return { action: "no_active", activeSession: null };
  }

  if (localSessionId && !serverActive) {
    store.reset();
    return { action: "no_active", activeSession: null };
  }

  return { action: "no_active", activeSession: null };
}
