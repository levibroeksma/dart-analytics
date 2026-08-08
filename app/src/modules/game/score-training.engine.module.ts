import type { ScoreTrainingSnapshot } from "@lib/types";
import { newClientKey } from "./client-key.module";
import { classify } from "@lib/game/board/board-geometry.module";
import { registerEngineFactory } from "./engine.registry";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  DartObservation,
  EngineFacts,
  EngineInputMode,
  ScoreTrainingInput,
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

const DARTS_PER_VISIT = 3;

function cloneTurns(turns: readonly TurnFact[]): TurnFact[] {
  return turns.map((turn) => ({ ...turn, darts: [...turn.darts] }));
}

/**
 * Score Training: every visit is one turn under a single exercise block.
 * Under QUICK_SCORE it is captured as a whole-visit total; under
 * VISUAL_BOARD it is captured one dart at a time, and the turn total is
 * derived as the sum of the counted dart scores. The engine owns the fact
 * log; `game.store.ts` persists a snapshot of it.
 */
export class ScoreTrainingEngine implements GameEngine<
  ScoreTrainingInput,
  ScoreTrainingState
> {
  readonly rulesetVersionKey = "SCORE_TRAINING_V1";
  private readonly turns: TurnFact[];
  private timerExpired = false;

  constructor(
    private readonly config: ScoreTrainingSnapshot,
    prior?: EngineFacts,
    private readonly inputMode: EngineInputMode = "QUICK_SCORE",
  ) {
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  /** A visit score is playable only as a whole number in `0..maxVisitScore`. */
  private isPlayable(visitScore: number): boolean {
    return (
      Number.isInteger(visitScore) &&
      visitScore >= 0 &&
      visitScore <= this.config.maxVisitScore
    );
  }

  /**
   * The single completion rule, evaluated against an arbitrary turn count so
   * both `isComplete()` (the count now) and `wouldComplete()` (the count one
   * visit ahead) read it rather than restating it.
   */
  private completesAt(turnCount: number): boolean {
    if (this.config.durationType === "ROUNDS") {
      return turnCount >= this.config.durationValue;
    }
    return this.timerExpired && turnCount >= 1;
  }

  /**
   * Records that the MINUTES countdown has elapsed. The countdown itself lives
   * in `game.store.ts`, not the engine, so expiry arrives as an explicit call
   * rather than as a write through the object `state()` returned — that object
   * is a derived copy, and writing to it changes nothing.
   */
  expireTimer(): void {
    this.timerExpired = true;
  }

  /**
   * Appends one visit total, or one dart, depending on the session's input
   * mode.
   * @throws when a quick-score visit is not a whole number within the
   *   ruleset's `0..maxVisitScore` range; the log is left untouched.
   */
  record(input: ScoreTrainingInput): ScoreTrainingState {
    if (this.inputMode === "VISUAL_BOARD") {
      return this.recordDart(input as DartObservation);
    }
    return this.recordVisitTotal(input as number);
  }

  private recordVisitTotal(visitScore: number): ScoreTrainingState {
    if (!this.isPlayable(visitScore)) {
      throw new Error(
        `Enter a score between 0 and ${this.config.maxVisitScore}.`,
      );
    }

    this.turns.push({
      clientKey: newClientKey(),
      stageClientKey: STAGE.clientKey,
      sequence: this.turns.length + 1,
      completedAt: new Date().toISOString(),
      totalScore: visitScore,
      darts: [],
    });
    return this.state();
  }

  /** The visit still being thrown, or null when the last one closed. */
  private openTurn(): TurnFact | null {
    const last = this.turns.at(-1);
    if (!last || last.darts.length >= DARTS_PER_VISIT) return null;
    return last;
  }

  private recordDart(observation: DartObservation): ScoreTrainingState {
    const resolved =
      observation.locationX === null || observation.locationY === null
        ? { targetNumber: null, zoneKey: observation.hitZoneKey, score: 0 }
        : classify(observation.locationX, observation.locationY);

    let turn = this.openTurn();
    if (!turn) {
      turn = {
        clientKey: newClientKey(),
        stageClientKey: STAGE.clientKey,
        sequence: this.turns.length + 1,
        completedAt: null,
        totalScore: 0,
        darts: [],
      };
      this.turns.push(turn);
    }

    turn.darts.push({
      sequence: turn.darts.length + 1,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: resolved.targetNumber,
      hitZoneKey: resolved.zoneKey,
      score: resolved.score,
      locationX: observation.locationX,
      locationY: observation.locationY,
    });

    turn.totalScore = turn.darts.reduce((sum, dart) => sum + dart.score, 0);
    if (turn.darts.length === DARTS_PER_VISIT) {
      turn.completedAt = new Date().toISOString();
    }

    return this.state();
  }

  /**
   * Pops the last recorded unit — a whole visit under quick score, a single
   * dart under visual capture, taking the turn with it when that dart was the
   * only one in it.
   * @returns true if something was removed; false if there was nothing to undo.
   */
  undo(): boolean {
    if (this.turns.length === 0) return false;

    if (this.inputMode !== "VISUAL_BOARD") {
      this.turns.pop();
      return true;
    }

    const turn = this.turns.at(-1);
    if (!turn) return false;

    turn.darts.pop();
    if (turn.darts.length === 0) {
      this.turns.pop();
      return true;
    }

    turn.totalScore = turn.darts.reduce((sum, dart) => sum + dart.score, 0);
    turn.completedAt = null;
    return true;
  }

  /**
   * Answers the finish-confirm gate without touching the fact log: the visit
   * is only ever recorded once, by `record()`, after the player confirms.
   * A score `record()` would reject never completes the session — the caller
   * falls through to `record()` and surfaces its range error instead.
   * Under `VISUAL_BOARD`, only a dart that completes an already-open visit
   * (one that already holds `DARTS_PER_VISIT - 1` darts) can complete the
   * session — a dart that opens a new visit never can.
   */
  wouldComplete(input: ScoreTrainingInput): boolean {
    if (this.inputMode === "VISUAL_BOARD") {
      const turn = this.openTurn();
      if (!turn || turn.darts.length !== DARTS_PER_VISIT - 1) return false;
      return this.completesAt(this.state().turnCount + 1);
    }

    if (!this.isPlayable(input as number)) return false;
    return this.completesAt(this.state().turnCount + 1);
  }

  isComplete(): boolean {
    return this.completesAt(this.state().turnCount);
  }

  state(): ScoreTrainingState {
    return {
      turnCount: this.turns.filter((turn) => turn.completedAt !== null).length,
      timerExpired: this.timerExpired,
    };
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const scoreTrainingEngineFactory: GameEngineFactory<
  ScoreTrainingSnapshot,
  ScoreTrainingInput,
  ScoreTrainingState
> = {
  rulesetVersionKey: "SCORE_TRAINING_V1",
  create(
    config: ScoreTrainingSnapshot,
    prior?: EngineFacts,
    inputMode?: EngineInputMode,
  ) {
    return new ScoreTrainingEngine(config, prior, inputMode);
  },
};

registerEngineFactory(scoreTrainingEngineFactory);
