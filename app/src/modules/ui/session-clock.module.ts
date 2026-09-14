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
  private onTick?: (elapsedSeconds: number) => void;

  constructor(options: SessionClockOptions = {}) {
    this.onTick = options.onTick;
  }

  start(): void {
    if (this.timerId !== null) return;
    this.startedAtMs = Date.now();
    this.timerId = setInterval(
      () => this.onTick?.(this.elapsedSeconds()),
      1000,
    );
  }

  elapsedSeconds(): number {
    if (this.startedAtMs === null) return 0;
    return Math.floor((Date.now() - this.startedAtMs) / 1000);
  }

  stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}
