import type { SegmentTimer } from "../ui/segment-timer.module";

export interface Calculation {
  readonly start: number;
  readonly subtraction: number;
  readonly expression: string;
}

export interface AnswerResult {
  readonly valid: boolean;
  readonly correct: boolean;
  readonly expected: number | null;
  readonly calculation: Calculation | null;
}

export interface QuickSubtractOptions {
  mode: "count" | "timer";
  count?: number;
  timer: SegmentTimer;
}
