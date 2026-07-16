interface SegmentTimerOptions {
  totalMinutes: number;
  intervalMinutes: number;
  onTick?: (secondsRemaining: number) => void;
  onSegmentChange?: (segmentIndex: number) => void;
  onComplete?: () => void;
}

export class SegmentTimer {
  private totalSeconds: number;
  private intervalSeconds: number;
  private remaining: number;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private audioCtx: AudioContext | null = null;

  private onTick?: (secondsRemaining: number) => void;
  private onSegmentChange?: (segmentIndex: number) => void;
  private onComplete?: () => void;

  constructor(options: SegmentTimerOptions) {
    this.totalSeconds = options.totalMinutes * 60;
    this.intervalSeconds = options.intervalMinutes * 60;
    this.remaining = this.totalSeconds;

    this.onTick = options.onTick;
    this.onSegmentChange = options.onSegmentChange;
    this.onComplete = options.onComplete;
  }

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    return this.audioCtx;
  }

  playBeep(frequency: number = 880, duration: number = 0.3): void {
    const ctx = this.getAudioContext();
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

    let segmentIndex = 0;

    this.timerId = setInterval(() => {
      this.remaining--;
      this.onTick?.(this.remaining);

      if (this.remaining > 0 && this.remaining % this.intervalSeconds === 0) {
        segmentIndex++;
        this.playBeep();
        this.onSegmentChange?.(segmentIndex);
      }

      if (this.remaining <= 0) {
        this.stop();
        this.playBeep(440, 0.6);
        this.onComplete?.();
      }
    }, 1000);
  }

  stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  reset(): void {
    this.stop();
    this.remaining = this.totalSeconds;
  }

  getRemaining(): number {
    return this.remaining;
  }
}
