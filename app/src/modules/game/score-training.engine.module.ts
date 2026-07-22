import type { RecordedVisit, ScoreTrainingEngineOptions } from "./types";

export class ScoreTrainingEngine {
  private visits: RecordedVisit[] = [];
  private startingSequence: number;

  constructor(private opts: ScoreTrainingEngineOptions) {
    this.startingSequence = opts.startingSequence ?? 0;
  }

  recordVisit(score: number): RecordedVisit {
    const visit: RecordedVisit = {
      clientKey: crypto.randomUUID(),
      sequence: this.startingSequence + this.visits.length + 1,
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

  /**
   * Pops the last visit recorded by this engine instance.
   * @returns true if a visit was removed; false if there was nothing to undo.
   */
  undoLastVisit(): boolean {
    if (this.visits.length === 0) return false;
    this.visits.pop();
    return true;
  }
}
