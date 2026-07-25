import type { ScoreTrainingSnapshot } from "@lib/game/rulesets/types";
import { registerEngineFactory } from "./engine.registry";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  EngineFacts,
  ScoreTrainingState,
  StageFact,
  TurnFact,
} from "./types";

const STAGE: StageFact = {
  clientKey: "block-1",
  stageTypeKey: "EXERCISE_BLOCK",
  parentClientKey: null,
  sequence: 1,
};

/**
 * Quick-score training: every visit is one turn under a single exercise block,
 * captured as a total rather than as individual darts. The engine owns the
 * fact log; `game.store.ts` persists a snapshot of it.
 */
export class ScoreTrainingEngine implements GameEngine<
  number,
  ScoreTrainingState
> {
  readonly rulesetVersionKey = "SCORE_TRAINING_V1";
  private readonly turns: TurnFact[];
  private readonly liveState: ScoreTrainingState;

  constructor(
    private readonly config: ScoreTrainingSnapshot,
    prior?: EngineFacts,
  ) {
    this.turns = prior ? [...prior.turns] : [];
    this.liveState = { turnCount: this.turns.length, timerExpired: false };
  }

  /**
   * Appends one visit to the fact log.
   * @throws when the visit score is not a whole number within the ruleset's
   *   `0..maxVisitScore` range; the log is left untouched.
   */
  record(visitScore: number): ScoreTrainingState {
    if (
      !Number.isInteger(visitScore) ||
      visitScore < 0 ||
      visitScore > this.config.maxVisitScore
    ) {
      throw new Error(
        `Enter a score between 0 and ${this.config.maxVisitScore}.`,
      );
    }

    this.turns.push({
      clientKey: crypto.randomUUID(),
      stageClientKey: STAGE.clientKey,
      sequence: this.turns.length + 1,
      completedAt: new Date().toISOString(),
      totalScore: visitScore,
      darts: [],
    });
    this.liveState.turnCount = this.turns.length;
    return this.liveState;
  }

  /**
   * Pops the last recorded visit, including one replayed from persisted facts.
   * @returns true if a visit was removed; false if there was nothing to undo.
   */
  undo(): boolean {
    if (this.turns.length === 0) return false;
    this.turns.pop();
    this.liveState.turnCount = this.turns.length;
    return true;
  }

  isComplete(): boolean {
    if (this.config.durationType === "ROUNDS") {
      return this.turns.length >= this.config.durationValue;
    }
    return this.liveState.timerExpired && this.turns.length >= 1;
  }

  /** Returns the engine's live state object; assigning `timerExpired` on it drives MINUTES completion. */
  state(): ScoreTrainingState {
    return this.liveState;
  }

  facts(): EngineFacts {
    return { stages: [STAGE], turns: [...this.turns] };
  }
}

export const scoreTrainingEngineFactory: GameEngineFactory<
  ScoreTrainingSnapshot,
  number,
  ScoreTrainingState
> = {
  rulesetVersionKey: "SCORE_TRAINING_V1",
  create(config: ScoreTrainingSnapshot, prior?: EngineFacts) {
    return new ScoreTrainingEngine(config, prior);
  },
};

registerEngineFactory(scoreTrainingEngineFactory);
