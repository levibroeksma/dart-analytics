export type TrebleSummary = {
  t20: number | null;
  t19: number | null;
  overall: number | null;
};

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
