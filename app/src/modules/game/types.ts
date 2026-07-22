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
