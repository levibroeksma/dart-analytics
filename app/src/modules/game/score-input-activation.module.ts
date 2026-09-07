import type { ScoreInputActivationEvent } from "./types";

/** Coalesce window for ghost/multi-click activations (ms). Tunable with test + manual evidence only. */
export const SCORE_INPUT_GHOST_MS = 40;

/**
 * Whether a score-input activation should be accepted: rejects `event.detail`
 * beyond a double-click (3+ is a ghost triple-fire) and anything inside the
 * ghost coalesce window.
 */
export function isScoreInputActivationAccepted(
  event: ScoreInputActivationEvent | undefined,
  elapsedSinceLastAccepted: number,
): boolean {
  if (event?.detail != null && event.detail > 2) return false;
  return elapsedSinceLastAccepted >= SCORE_INPUT_GHOST_MS;
}
