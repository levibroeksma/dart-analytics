const COMPLETE_LABEL = "complete";

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const seconds = Math.max(0, totalSeconds) % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * The routine-wide clock and the step it is currently running, read by
 * `GameLayout`'s header. It lives in a store rather than the play page's own
 * `x-data` because the header renders in the layout's Alpine scope, which is
 * an ancestor of the page's — an expression there can never reach a page
 * component's members.
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

    get stepLabel(): string {
      if (this.complete) return COMPLETE_LABEL;
      return this.stepKey ?? "";
    },

    get headerLabel(): string {
      if (!this.stepKey) return "";
      return `${formatElapsed(this.elapsedSeconds)} - ${this.stepLabel}`;
    },

    startSession() {
      this.active = true;
      this.complete = false;
      this.elapsedSeconds = 0;
    },

    setStep(stepLabel: string) {
      this.stepKey = stepLabel;
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
    },
  };
}
