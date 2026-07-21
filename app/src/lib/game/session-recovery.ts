import { completeSession, type SessionActiveData } from "@client/api/sessions";

interface StoreLike {
  reset(): void;
}

/**
 * Shared D88 reconciliation decision table (identical on setup and play).
 * The only implementation — setup and play both import this directly.
 *
 * "match": server ACTIVE session's sessionId equals local; caller resumes
 *   (setup: Continue/Abandon modal; play: keep store, hasActiveSession = true).
 *   Store is left untouched.
 * "no_active": no server ACTIVE session, or a mismatch that was successfully
 *   auto-abandoned. Store has already been reset by this function.
 * "abandon_failed": mismatch found but the auto-abandon PATCH failed. Store is
 *   NOT touched. Caller must block session creation and offer retry — never
 *   treat this the same as "no_active".
 */
export async function reconcileActiveSession(
  localSessionId: string | null,
  serverSessions: SessionActiveData[],
  store: StoreLike,
): Promise<{
  action: "match" | "no_active" | "abandon_failed";
  activeSession: SessionActiveData | null;
}> {
  const scoreTrainingActive = serverSessions.find(
    (s) => s.gameTypeKey === "SCORE_TRAINING",
  );

  // Case 1: Match — resume path, store untouched
  if (
    localSessionId &&
    scoreTrainingActive &&
    scoreTrainingActive.sessionId === localSessionId
  ) {
    return { action: "match", activeSession: scoreTrainingActive };
  }

  // Case 2: Mismatch — auto-PATCH orphan to ABANDONED synchronously
  if (
    scoreTrainingActive &&
    (!localSessionId || scoreTrainingActive.sessionId !== localSessionId)
  ) {
    try {
      await completeSession(scoreTrainingActive.sessionId, "ABANDONED");
    } catch {
      // Abandon failed: do NOT reset the store or report "no_active" — the
      // orphan is still ACTIVE server-side, so creating a session now would
      // violate uq_sessions_single_active. Caller must block and retry.
      return { action: "abandon_failed", activeSession: null };
    }
    store.reset();
    return { action: "no_active", activeSession: null };
  }

  // Case 3: Local present, no server ACTIVE — local is stale, nothing to abandon
  if (localSessionId && !scoreTrainingActive) {
    store.reset();
    return { action: "no_active", activeSession: null };
  }

  // Case 4: Both empty
  return { action: "no_active", activeSession: null };
}
