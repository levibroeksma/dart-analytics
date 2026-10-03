export type TrebleSummary = {
  t20: number | null;
  t19: number | null;
  overall: number | null;
};

export type CompletionSummary = {
  completed: number;
  abandoned: number;
  neverStarted: number;
  abandonRate: number | null;
};

export type VolumeSummary = {
  sessions: number;
  darts: number;
  minutes: number;
};

export type ScoreResultSummary = {
  sessions: number;
  average: number | null;
  best: { value: number; sessionId: string } | null;
};

export type SessionRow = {
  id: string;
  href: string;
  date: string;
  average: number | null;
  darts: number;
  minutes: number;
  abandoned: boolean;
};
