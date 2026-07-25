/**
 * Score Training's engine state. `timerExpired` is caller-driven: the MINUTES
 * countdown lives in `game.store.ts`, not the engine, so the play page assigns
 * it on the object returned by `state()`/`record()` before asking
 * `isComplete()` — keeping the contract's zero-argument `isComplete()` intact.
 */
export type ScoreTrainingState = {
  turnCount: number;
  timerExpired: boolean;
};

export type ScoreInputBufferOptions = {
  maxLength?: number;
};

/** Minimal click-like shape for activation guard (`detail` from MouseEvent). */
export type ScoreInputActivationEvent = {
  detail?: number;
};

export type Bobs27State = {
  targetIndex: number;
  score: number;
  dartsThisVisit: boolean[];
  status: "IN_PROGRESS" | "WON" | "LOST";
};

export type SinglesTrainingState = {
  targetIndex: number;
  totalPoints: number;
  dartsThisVisit: number;
  status: "IN_PROGRESS" | "COMPLETE";
};

export type DoublesVisitOutcome = {
  targetIndex: number;
  hit: boolean;
  hitDartNumber: 1 | 2 | 3 | null;
};

export type DoublesTrainingState = {
  targetIndex: number;
  dartsThisVisit: number;
  outcomes: DoublesVisitOutcome[];
  status: "IN_PROGRESS" | "COMPLETE";
};

export type FiveOhOneCheckout = {
  dartsUsed: 1 | 2 | 3;
  dartsOnDouble: 0 | 1 | 2 | 3;
};

export type FiveOhOneVisitOutcome = {
  scoreAttempted: number;
  isBust: boolean;
  remainingAfter: number;
  checkout?: FiveOhOneCheckout;
};

export type FiveOhOneState = {
  remainingScore: number;
  visitHistory: FiveOhOneVisitOutcome[];
  status: "IN_PROGRESS" | "WON";
};

export const FIVE_OH_ONE_START_SCORE = 501;

export type DartZoneKey =
  "SINGLE" | "DOUBLE" | "TREBLE" | "OUTER_BULL" | "INNER_BULL" | "MISS";

export type StageTypeKey = "MATCH" | "SET" | "LEG" | "ROUND" | "EXERCISE_BLOCK";

export type BoardTarget =
  | { kind: "NUMBER"; number: number }
  | { kind: "DOUBLE"; number: number }
  | { kind: "BULL" };

/** What the player did, as observed at input time — the engine's only input. */
export type DartObservation = {
  hitTargetNumber: number | null;
  hitZoneKey: DartZoneKey;
};

/** One row of `darts`. `score` is the actual board score, never a game-specific point value. */
export type DartFact = {
  sequence: number;
  intendedTargetNumber: number | null;
  intendedZoneKey: DartZoneKey | null;
  hitTargetNumber: number | null;
  hitZoneKey: DartZoneKey;
  score: number;
};

/** One row of `turns`. `totalScore` is the counted board score — 0 for a void visit, never negative. */
export type TurnFact = {
  clientKey: string;
  stageClientKey: string;
  sequence: number;
  completedAt: string;
  totalScore: number;
  darts: DartFact[];
};

/** One row of `exercise_stages`. */
export type StageFact = {
  clientKey: string;
  stageTypeKey: StageTypeKey;
  parentClientKey: string | null;
  sequence: number;
};

export type EngineFacts = {
  stages: StageFact[];
  turns: TurnFact[];
};
