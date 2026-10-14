import type { SessionActiveData } from "@client/api/sessions";

interface StoreLike {
  reset(): void;
}

/**
 * Shared reconciliation decision table (identical on setup and play, and
 * across every game). The only implementation — each game's setup and play
 * data factories import this directly and pass their own `gameTypeKey`, so a
 * session belonging to another game is never matched here. It never ends a
 * session: only the player abandons one (D460).
 *
 * "match": server ACTIVE session's sessionId equals local; caller resumes
 *   (setup: Continue/Abandon modal; play: keep store, hasActiveSession = true).
 *   Store is left untouched.
 * "elsewhere": server ACTIVE session this device does not hold (another
 *   device, or a store since reused for another game). Store is left
 *   untouched; setup asks before abandoning it, play shows no session.
 * "no_active": no server ACTIVE session for this game type. A local session
 *   the server no longer holds has been reset by this function.
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
  action: "match" | "elsewhere" | "no_active";
  activeSession: SessionActiveData | null;
}> {
  const serverActive = serverSessions.find(
    (s) => s.gameTypeKey === gameTypeKey,
  );

  if (serverActive) {
    return {
      action: serverActive.sessionId === localSessionId ? "match" : "elsewhere",
      activeSession: serverActive,
    };
  }

  if (localSessionId) store.reset();
  return { action: "no_active", activeSession: null };
}
