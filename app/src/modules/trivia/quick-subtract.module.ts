import { getRandomDartScore } from "./dart-scores.module";
import type { SegmentTimer } from "../ui/segment-timer.module";
import type { GameStatus } from "./types";
import type {
  AnswerResult,
  Calculation,
  QuickSubtractOptions,
} from "./interfaces";

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function nextCalculation(): Calculation {
  const start = randomInt(2, 501);
  const subtraction = getRandomDartScore(start);
  return { start, subtraction, expression: `${start} - ${subtraction}` };
}

function parseAnswerValue(value: number | string): number | null {
  if (value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function invalidAnswerResult(): AnswerResult {
  return { valid: false, correct: false, expected: null, calculation: null };
}

export class QuickSubtractGame {
  private mode: "count" | "timer";
  private targetCount: number | null;
  private timer: SegmentTimer;
  private status: GameStatus = "idle";
  private current: Calculation | null = null;
  private correctAnswers = 0;
  private attempts = 0;
  private incorrectAnswers = 0;

  constructor(options: QuickSubtractOptions) {
    this.mode = options.mode;
    this.targetCount =
      options.mode === "count" ? (options.count ?? null) : null;
    this.timer = options.timer;
  }

  start(): void {
    if (this.status !== "idle") return;
    this.status = "running";
    this.timer.start();
    this.nextRound();
  }

  answer(value: number | string): AnswerResult {
    const numeric = parseAnswerValue(value);
    if (this.status !== "running" || !this.current || numeric === null) {
      return invalidAnswerResult();
    }

    const calculation = this.current;
    const expected = calculation.start - calculation.subtraction;
    const correct = numeric === expected;

    this.recordAttempt(correct);

    return { valid: true, correct, expected, calculation };
  }

  finish(): void {
    if (this.status !== "running") return;
    this.status = "finished";
    this.timer.stop();
  }

  destroy(): void {
    this.timer.stop();
  }

  getStatus(): GameStatus {
    return this.status;
  }

  getCurrent(): Calculation | null {
    return this.current;
  }

  getCorrectAnswers(): number {
    return this.correctAnswers;
  }

  getAttempts(): number {
    return this.attempts;
  }

  getIncorrectAnswers(): number {
    return this.incorrectAnswers;
  }

  getElapsedTime(): number {
    return this.timer.getElapsed();
  }

  getRemainingTime(): number {
    return this.mode === "count" ? 0 : this.timer.getRemaining();
  }

  private nextRound(): void {
    this.current = nextCalculation();
  }

  private recordAttempt(correct: boolean): void {
    this.attempts++;
    if (correct) {
      this.correctAnswers++;
    } else {
      this.incorrectAnswers++;
    }

    const targetReached =
      this.mode === "count" &&
      this.correctAnswers >= (this.targetCount ?? Infinity);
    if (targetReached) {
      this.finish();
    } else {
      this.nextRound();
    }
  }
}
