export type GameConfigSnapshot = {
  durationType: "ROUNDS" | "MINUTES";
  durationValue: number;
  maxDartsPerTurn: number;
};

export type RecordedTurn = {
  clientKey: string;
  sequence: number;
  totalScore: number;
  completedAt: string | null;
};
