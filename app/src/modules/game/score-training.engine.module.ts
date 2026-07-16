export type ScoreTrainingEngineOptions = {
  durationType: "ROUNDS" | "MINUTES";
  durationValue: number;
  maxDartsPerTurn: number;
};

export type RecordedVisit = {
  clientKey: string;
  sequence: number;
  totalScore: number;
  completedAt: string;
};

export class ScoreTrainingEngine {
  private visits: RecordedVisit[] = [];

  constructor(private opts: ScoreTrainingEngineOptions) {}

  recordVisit(score: number): RecordedVisit {
    const visit: RecordedVisit = {
      clientKey: crypto.randomUUID(),
      sequence: this.visits.length + 1,
      totalScore: score,
      completedAt: new Date().toISOString(),
    };
    this.visits.push(visit);
    return visit;
  }

  isComplete(turnsSoFar: number, timerExpired: boolean): boolean {
    if (this.opts.durationType === "ROUNDS") {
      return turnsSoFar >= this.opts.durationValue;
    }
    return timerExpired && turnsSoFar >= 1;
  }

  currentTotal(): number {
    return this.visits.reduce((sum, v) => sum + v.totalScore, 0);
  }

  currentAverage(): number {
    if (this.visits.length === 0) return 0;
    return this.currentTotal() / this.visits.length;
  }
}
