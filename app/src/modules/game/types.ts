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
