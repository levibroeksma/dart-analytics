import type { SegmentTimerOptions } from "./interfaces";

function cumulativeSums(durationsSeconds: number[]): number[] {
  let running = 0;
  return durationsSeconds.map((duration) => {
    running += duration;
    return running;
  });
}

export class SegmentTimer {
  private totalSeconds: number;
  private intervalSeconds: number;
  private segmentBoundaries: number[] | null;
  private remaining: number;
  private direction: "countdown" | "countup";
  private timerId: ReturnType<typeof setInterval> | null = null;
  private audioCtx: AudioContext | null = null;
  private segmentIndex = 0;

  private onTick?: (secondsRemaining: number) => void;
  private onSegmentChange?: (segmentIndex: number) => void;
  private onComplete?: () => void;

  constructor(options: SegmentTimerOptions) {
    if (
      options.segmentDurationsSeconds === undefined &&
      options.totalMinutes === undefined
    ) {
      throw new Error(
        "SegmentTimer requires either totalMinutes or segmentDurationsSeconds",
      );
    }
    this.segmentBoundaries = options.segmentDurationsSeconds
      ? cumulativeSums(options.segmentDurationsSeconds)
      : null;
    this.totalSeconds = this.segmentBoundaries
      ? this.segmentBoundaries[this.segmentBoundaries.length - 1]
      : options.totalMinutes! * 60;
    this.intervalSeconds = (options.intervalMinutes ?? 0) * 60;
    this.direction = options.direction ?? "countdown";
    this.remaining = this.direction === "countup" ? 0 : this.totalSeconds;

    this.onTick = options.onTick;
    this.onSegmentChange = options.onSegmentChange;
    this.onComplete = options.onComplete;
  }

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    return this.audioCtx;
  }

  /**
   * Creates (or reuses) the `AudioContext` and resumes it if suspended. Must
   * be called synchronously from within a real user-gesture event handler
   * (e.g. a click) — browser autoplay policy only lifts a suspended context
   * inside that call stack, never from a later `setInterval` tick. Callers
   * that drive `playBeep()` from a timer with no further user interaction
   * (the Warm-Up ping) call this once, up front, from the gesture that
   * starts the timer.
   */
  unlockAudio(): void {
    this.resumeIfSuspended(this.getAudioContext());
  }

  private resumeIfSuspended(ctx: AudioContext): void {
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
  }

  playBeep(frequency: number = 880, duration: number = 0.3): void {
    const ctx = this.getAudioContext();
    this.resumeIfSuspended(ctx);
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
  }

  start(): void {
    if (this.timerId !== null) return;

    this.segmentIndex = 0;
    this.timerId = setInterval(() => this.tick(), 1000);
  }

  private tick(): void {
    if (this.direction === "countup") {
      this.tickCountup();
    } else {
      this.tickCountdown();
    }
  }

  private tickCountup(): void {
    this.remaining++;
    this.onTick?.(this.remaining);

    if (
      this.segmentBoundaries &&
      this.segmentIndex < this.segmentBoundaries.length - 1 &&
      this.remaining >= this.segmentBoundaries[this.segmentIndex]
    ) {
      this.segmentIndex++;
      this.playBeep();
      this.onSegmentChange?.(this.segmentIndex);
    }

    if (this.remaining >= this.totalSeconds) {
      this.completeTimer();
    }
  }

  private tickCountdown(): void {
    this.remaining--;
    this.onTick?.(this.remaining);

    if (this.remaining > 0 && this.remaining % this.intervalSeconds === 0) {
      this.segmentIndex++;
      this.playBeep();
      this.onSegmentChange?.(this.segmentIndex);
    }

    if (this.remaining <= 0) {
      this.completeTimer();
    }
  }

  private completeTimer(): void {
    this.stop();
    this.playBeep(440, 0.6);
    this.onComplete?.();
  }

  stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  // fallow-ignore-next-line unused-class-member -- module adopted verbatim from an existing source; kept as originally authored
  reset(): void {
    this.stop();
    this.remaining = this.totalSeconds;
  }

  getRemaining(): number {
    return this.remaining;
  }

  getElapsed(): number {
    return this.direction === "countup"
      ? this.remaining
      : this.totalSeconds - this.remaining;
  }
}
