/**
 * The Finishing step creates a real TUOD session, so `uq_sessions_single_active`
 * rejects it whenever the player already has an unfinished TUOD game — one left
 * open by navigating away from a standalone game or an earlier routine. Only the
 * player can decide that game's fate (it may hold real darts), so the routine
 * names it rather than resolving it (issue #355).
 */
const ACTIVE_FINISHING_SESSION_MESSAGE =
  "You have an unfinished Ten Up One Down game. Finish or abandon it under Games, then start this routine again.";

/**
 * The on-screen message for a failed routine step advance. An already-active
 * session is the one failure the player can act on, so it gets its own wording;
 * everything else names the error code and, when the envelope carried one, the
 * request id that ties it to its Worker log line (D282).
 */
export function stepAdvanceErrorMessage(error: unknown): string {
  const { code, requestId } = error as {
    code?: string;
    requestId?: string;
  };
  if (code === "SESSION_ALREADY_ACTIVE")
    return ACTIVE_FINISHING_SESSION_MESSAGE;
  if (!code) return "Could not continue to the next step. Try again.";
  const trace = requestId ? `, ${requestId}` : "";
  return `Could not continue to the next step (${code}${trace}). Try again.`;
}
