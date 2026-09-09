export interface SegmentTimerOptions {
  totalMinutes: number;
  intervalMinutes: number;
  direction?: "countdown" | "countup";
  onTick?: (secondsRemaining: number) => void;
  onSegmentChange?: (segmentIndex: number) => void;
  onComplete?: () => void;
}
