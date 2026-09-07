import {
  isScoreInputActivationAccepted,
  SCORE_INPUT_GHOST_MS,
} from "./score-input-activation.module";
import type {
  ScoreInputActivationEvent,
  ScoreInputBufferOptions,
} from "./types";

export { SCORE_INPUT_GHOST_MS };

export class ScoreInputBuffer {
  value = "";
  private readonly maxLength: number;
  /** Negative infinity so the first press is never ghost-rejected when clocks start at 0 (Vitest fake timers). */
  private lastAcceptedAt = Number.NEGATIVE_INFINITY;

  constructor(options: ScoreInputBufferOptions = {}) {
    this.maxLength = options.maxLength ?? 3;
  }

  appendDigit(digit: number, event?: ScoreInputActivationEvent): void {
    if (!this.acceptActivation(event)) return;
    const next =
      this.value === "0" ? String(digit) : this.value + String(digit);
    if (next.length > this.maxLength) return;
    this.value = next;
  }

  deleteLast(event?: ScoreInputActivationEvent): void {
    if (!this.acceptActivation(event)) return;
    this.value = this.value.slice(0, -1);
  }

  clear(): void {
    this.value = "";
    this.lastAcceptedAt = Number.NEGATIVE_INFINITY;
  }

  setValue(next: string): void {
    this.value = next;
    this.lastAcceptedAt = Number.NEGATIVE_INFINITY;
  }

  asNumber(): number | null {
    return this.value === "" ? null : Number(this.value);
  }

  private acceptActivation(event?: ScoreInputActivationEvent): boolean {
    const now = Date.now();
    if (!isScoreInputActivationAccepted(event, now - this.lastAcceptedAt)) {
      return false;
    }
    this.lastAcceptedAt = now;
    return true;
  }
}
