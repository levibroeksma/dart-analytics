import type { SessionClockOptions } from "./interfaces";

/**
 * One open-ended count-up clock for a whole training session: started once
 * when the first exercise begins and read until the last one ends, across
 * every step's own `SegmentTimer`.
 *
 * Elapsed time is derived from the wall clock rather than counted per tick,
 * so a throttled or backgrounded tab resumes with the true elapsed total
 * instead of the number of ticks the browser chose to deliver.
 */
export class SessionClock {
  private startedAtMs: number | null = null;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private pausedAtMs: number | null = null;
  private pausedTotalMs = 0;
  private onTick?: (elapsedSeconds: number) => void;

  constructor(options: SessionClockOptions = {}) {
    this.onTick = options.onTick;
  }

  start(): void {
    if (this.timerId !== null) return;
    this.startedAtMs = Date.now();
    this.pausedAtMs = null;
    this.pausedTotalMs = 0;
    this.schedule();
  }

  private schedule(): void {
    this.timerId = setInterval(
      () => this.onTick?.(this.elapsedSeconds()),
      1000,
    );
  }

  /** Freezes elapsed time; the paused span is excluded once resumed. */
  pause(): void {
    if (this.timerId === null) return;
    clearInterval(this.timerId);
    this.timerId = null;
    this.pausedAtMs = Date.now();
  }

  resume(): void {
    if (this.pausedAtMs === null) return;
    this.pausedTotalMs += Date.now() - this.pausedAtMs;
    this.pausedAtMs = null;
    this.schedule();
  }

  elapsedSeconds(): number {
    if (this.startedAtMs === null) return 0;
    const nowMs = this.pausedAtMs ?? Date.now();
    return Math.floor((nowMs - this.startedAtMs - this.pausedTotalMs) / 1000);
  }

  stop(): void {
    this.pausedAtMs = null;
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}
