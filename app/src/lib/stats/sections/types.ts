export type CompletionSummary = {
  completed: number;
  abandoned: number;
  abandonRate: number | null;
};

export type SessionRow = {
  id: string;
  date: string;
  average: number | null;
  darts: number;
  minutes: number;
};
