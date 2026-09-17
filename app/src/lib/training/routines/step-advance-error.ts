/**
 * The on-screen message for a failed routine step advance. It names the error
 * code and, when the envelope carried one, the request id that ties it to its
 * Worker log line (D282). An already-active game never reaches here — the
 * routine resolves that one in place (`step-session-conflict.ts`, issue #357).
 */
export function stepAdvanceErrorMessage(error: unknown): string {
  const { code, requestId } = error as {
    code?: string;
    requestId?: string;
  };
  if (!code) return "Could not continue to the next step. Try again.";
  const trace = requestId ? `, ${requestId}` : "";
  return `Could not continue to the next step (${code}${trace}). Try again.`;
}
