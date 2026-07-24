import type { Bobs27State, Bobs27Target } from "./types";
import { BOBS27_START_SCORE, BULL_HIT_VALUE } from "./types";

function targetForIndex(targetIndex: number): Bobs27Target {
  return targetIndex < 20
    ? { kind: "DOUBLE", number: targetIndex + 1 }
    : { kind: "BULL" };
}

function targetValue(target: Bobs27Target): number {
  return target.kind === "DOUBLE" ? target.number : BULL_HIT_VALUE;
}

export function initialBobs27State(startingScore: number): Bobs27State {
  return {
    targetIndex: 0,
    score: startingScore,
    dartsThisVisit: [],
    status: "IN_PROGRESS",
  };
}

export function applyDart(state: Bobs27State, hit: boolean): Bobs27State {
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a dart once the game has ended; undo first to correct it.",
    );
  }

  const target = targetForIndex(state.targetIndex);
  const dartsThisVisit = [...state.dartsThisVisit, hit];
  const score = hit ? state.score + targetValue(target) : state.score;

  if (dartsThisVisit.length < 3) {
    return { ...state, score, dartsThisVisit };
  }

  const visitHits = dartsThisVisit.filter(Boolean).length;
  const resolvedScore = visitHits === 0 ? score - targetValue(target) : score;

  if (resolvedScore <= 0) {
    return {
      ...state,
      score: resolvedScore,
      dartsThisVisit: [],
      status: "LOST",
    };
  }
  if (target.kind === "BULL") {
    return {
      ...state,
      score: resolvedScore,
      dartsThisVisit: [],
      status: "WON",
    };
  }
  return {
    ...state,
    score: resolvedScore,
    dartsThisVisit: [],
    targetIndex: state.targetIndex + 1,
  };
}

export class Bobs27Engine {
  private state: Bobs27State;
  private history: Bobs27State[] = [];

  constructor(startingScore: number = BOBS27_START_SCORE) {
    this.state = initialBobs27State(startingScore);
  }

  recordDart(hit: boolean): Bobs27State {
    this.history.push(this.state);
    this.state = applyDart(this.state, hit);
    return this.state;
  }

  /** Reverts exactly the last recorded dart, one at a time, even across visit/game-over boundaries. */
  undoLastDart(): boolean {
    if (this.history.length === 0) return false;
    this.state = this.history.pop()!;
    return true;
  }

  currentTarget(): Bobs27Target {
    return targetForIndex(this.state.targetIndex);
  }

  currentScore(): number {
    return this.state.score;
  }

  isGameOver(): boolean {
    return this.state.status !== "IN_PROGRESS";
  }

  result(): "WON" | "LOST" | null {
    return this.state.status === "IN_PROGRESS" ? null : this.state.status;
  }
}
