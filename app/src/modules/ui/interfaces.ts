export interface SegmentTimerOptions {
  totalMinutes?: number;
  intervalMinutes?: number;
  direction?: "countdown" | "countup";
  segmentDurationsSeconds?: number[];
  onTick?: (secondsRemaining: number) => void;
  onSegmentChange?: (segmentIndex: number) => void;
  onComplete?: () => void;
}
