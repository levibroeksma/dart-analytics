export type ScoreTrainingEngineOptions = {
  durationType: "ROUNDS" | "MINUTES";
  durationValue: number;
  maxDartsPerTurn: number;
  startingSequence?: number;
};

export type RecordedVisit = {
  clientKey: string;
  sequence: number;
  totalScore: number;
  completedAt: string;
};

export type ScoreInputBufferOptions = {
  maxLength?: number;
};

/** Minimal click-like shape for activation guard (`detail` from MouseEvent). */
export type ScoreInputActivationEvent = {
  detail?: number;
};

export type Bobs27Target =
  { kind: "DOUBLE"; number: number } | { kind: "BULL" };

export type Bobs27State = {
  targetIndex: number;
  score: number;
  dartsThisVisit: boolean[];
  status: "IN_PROGRESS" | "WON" | "LOST";
};

export const BOBS27_START_SCORE = 27;
export const BOBS27_BULL_HIT_VALUE = 50;

export type SinglesTarget =
  { kind: "NUMBER"; number: number } | { kind: "BULL" };

export type DartRing = "SINGLE" | "DOUBLE" | "TREBLE" | "MISS";

export type SinglesTrainingState = {
  targetIndex: number;
  totalPoints: number;
  dartsThisVisit: number;
  status: "IN_PROGRESS" | "COMPLETE";
};

export const SINGLES_TRAINING_START_POINTS = 0;

export type DoublesTarget =
  { kind: "DOUBLE"; number: number } | { kind: "BULL" };

export type VisitOutcome = {
  targetIndex: number;
  hit: boolean;
  hitDartNumber: 1 | 2 | 3 | null;
};

export type DoublesTrainingState = {
  targetIndex: number;
  dartsThisVisit: number;
  visitHistory: VisitOutcome[];
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
