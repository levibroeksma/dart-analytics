const COMPLETE_LABEL = "complete";

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const seconds = Math.max(0, totalSeconds) % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * The routine-wide clock and the step it is currently running, shared with
 * the routine summary and the game steps. The play header reads
 * `routineHeader()` through the page's own scope, not this store.
 *
 * Not persisted: a session's clock is only meaningful while that session is
 * on screen, and a reload restarts the routine rather than resuming it.
 */
export function trainingSessionStore() {
  return {
    active: false,
    elapsedSeconds: 0,
    stepKey: null as string | null,
    complete: false,
    /** The session id of the game step on screen; a guard flag, not persisted. */
    gameSessionId: null as string | null,

    get stepLabel(): string {
      if (this.complete) return COMPLETE_LABEL;
      return this.stepKey ?? "";
    },

    get elapsedLabel(): string {
      return formatElapsed(this.elapsedSeconds);
    },

    startSession() {
      this.active = true;
      this.complete = false;
      this.elapsedSeconds = 0;
    },

    setStep(stepLabel: string) {
      this.stepKey = stepLabel;
    },

    setGameSession(sessionId: string | null) {
      this.gameSessionId = sessionId;
    },

    markComplete() {
      this.complete = true;
    },

    tick(elapsedSeconds: number) {
      this.elapsedSeconds = elapsedSeconds;
    },

    reset() {
      this.active = false;
      this.complete = false;
      this.elapsedSeconds = 0;
      this.stepKey = null;
      this.gameSessionId = null;
    },
  };
}
