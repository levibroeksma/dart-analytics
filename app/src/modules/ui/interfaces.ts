export interface SegmentTimerOptions {
  totalMinutes: number;
  intervalMinutes: number;
  onTick?: (secondsRemaining: number) => void;
  onSegmentChange?: (segmentIndex: number) => void;
  onComplete?: () => void;
}
