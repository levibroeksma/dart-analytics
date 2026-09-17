/**
 * The on-screen message for a failed routine start. A coded failure names its
 * code and, when the envelope carried one, the request id that ties it to its
 * Worker log line (D282) — the same contract `step-advance-error.ts` gives a
 * failed step advance. Only an uncoded failure, which is a transport failure,
 * keeps the connection wording.
 */
export function routineStartErrorMessage(error: unknown): string {
  const { code, requestId } = error as { code?: string; requestId?: string };
  if (!code)
    return "Could not start this routine. Check your connection and retry.";
  const trace = requestId ? `, ${requestId}` : "";
  return `Could not start this routine (${code}${trace}). Try again.`;
}
