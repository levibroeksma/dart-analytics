import type { Bobs27Snapshot } from "@lib/game/rulesets/types";
import {
  BULL_TARGET_NUMBER,
  boardScore,
  doublesPath,
  isHitOn,
  targetAt,
} from "./board-progression.module";
import { registerEngineFactory } from "./engine.registry";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  BoardTarget,
  Bobs27State,
  DartFact,
  DartObservation,
  DartZoneKey,
  EngineFacts,
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
 * Bob's 27 starting state: the ruleset's starting score, aimed at the first
 * double on the doubles path, with no darts thrown yet.
 */
export function initialBobs27State(config: Bobs27Snapshot): Bobs27State {
  return {
    targetIndex: 0,
    score: config.startScore,
    dartsThisVisit: [],
    status: "IN_PROGRESS",
  };
}

function pointValueOf(target: BoardTarget, config: Bobs27Snapshot): number {
  return target.kind === "BULL" ? config.bullHitValue : target.number;
}

/**
 * Pure reducer: folds one dart observation onto a `Bobs27State`. A hit adds
 * the current target's point value immediately; a visit resolves on its 3rd
 * dart, where a full miss subtracts that value scaled by the ruleset's miss
 * penalty multiplier. Any hit advances to the next target with no penalty.
 * The path ends at BULL: a resolved score at or below zero loses regardless
 * of target, otherwise clearing BULL wins.
 * @throws when `state.status` is not `IN_PROGRESS`; undo first to correct it.
 */
export function applyBobs27Dart(
  config: Bobs27Snapshot,
  state: Bobs27State,
  observation: DartObservation,
): Bobs27State {
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a dart once the game has ended; undo first to correct it.",
    );
  }

  const target = targetAt(doublesPath(), state.targetIndex);
  const pointValue = pointValueOf(target, config);
  const hit = isHitOn(target, observation);
  const dartsThisVisit = [...state.dartsThisVisit, hit];
  const score = hit ? state.score + pointValue : state.score;

  if (dartsThisVisit.length < 3) {
    return { ...state, score, dartsThisVisit };
  }

  const visitHits = dartsThisVisit.filter(Boolean).length;
  const resolvedScore =
    visitHits === 0 ? score - pointValue * config.missPenaltyMultiplier : score;

  if (resolvedScore <= 0) {
    return {
      ...state,
      score: resolvedScore,
      dartsThisVisit: [],
      status: "LOST",
    };
  }
  if (target.kind === "BULL") {
    return {
      ...state,
      score: resolvedScore,
      dartsThisVisit: [],
      status: "WON",
    };
  }
  return {
    ...state,
    score: resolvedScore,
    dartsThisVisit: [],
    targetIndex: state.targetIndex + 1,
  };
}

function sumDartScores(darts: readonly DartFact[]): number {
  return darts.reduce((total, dart) => total + dart.score, 0);
}

function cloneTurns(turns: readonly TurnFact[]): TurnFact[] {
  return turns.map((turn) => ({ ...turn, darts: [...turn.darts] }));
}

/**
 * Bob's 27: a fixed path of 21 targets (D1..D20, then BULL) played to a
 * full-hit clear of BULL or a bust at zero. The engine owns the fact log —
 * `state()` derives the running score, current target and win/loss status by
 * folding `facts()` through `applyBobs27Dart`; none of them is ever stored.
 */
export class Bobs27Engine implements GameEngine<DartObservation, Bobs27State> {
  readonly rulesetVersionKey = "BOBS27_V1";
  private readonly turns: TurnFact[];

  constructor(
    private readonly config: Bobs27Snapshot,
    prior?: EngineFacts,
  ) {
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): Bobs27State {
    let state = initialBobs27State(this.config);
    for (const turn of this.turns) {
      for (const dart of turn.darts) {
        state = applyBobs27Dart(this.config, state, {
          hitTargetNumber: dart.hitTargetNumber,
          hitZoneKey: dart.hitZoneKey,
        });
      }
    }
    return state;
  }

  private openOrCreateTurn(): TurnFact {
    const last = this.turns.at(-1);
    if (last && last.darts.length < 3) return last;

    const turn: TurnFact = {
      clientKey: crypto.randomUUID(),
      stageClientKey: STAGE.clientKey,
      sequence: this.turns.length + 1,
      completedAt: new Date().toISOString(),
      totalScore: 0,
      darts: [],
    };
    this.turns.push(turn);
    return turn;
  }

  /**
   * Appends one dart to the open visit, opening a new one when the last is
   * already 3 darts deep. `intendedTargetNumber`/`intendedZoneKey` capture
   * the target this dart was thrown at, ahead of what it actually hit; the
   * fact's `score` is the dart's board score, never the game-specific point
   * value the derived running score adds.
   * @throws when the game has already ended; the fact log is left untouched.
   */
  record(observation: DartObservation): Bobs27State {
    const before = this.deriveState();
    const target = targetAt(doublesPath(), before.targetIndex);
    const after = applyBobs27Dart(this.config, before, observation);

    const openTurn = this.openOrCreateTurn();
    const intendedZoneKey: DartZoneKey =
      target.kind === "BULL" ? "INNER_BULL" : "DOUBLE";
    const dart: DartFact = {
      sequence: openTurn.darts.length + 1,
      intendedTargetNumber:
        target.kind === "BULL" ? BULL_TARGET_NUMBER : target.number,
      intendedZoneKey,
      hitTargetNumber: observation.hitTargetNumber,
      hitZoneKey: observation.hitZoneKey,
      score: boardScore(observation.hitTargetNumber, observation.hitZoneKey),
    };

    openTurn.darts.push(dart);
    openTurn.totalScore = sumDartScores(openTurn.darts);

    return after;
  }

  /**
   * Pops the last recorded dart, including one replayed from persisted
   * facts, and removes the visit entirely once it holds no darts — the
   * exact inverse of the `record()` call that created it.
   * @returns true if a dart was removed; false if there was nothing to undo.
   */
  undo(): boolean {
    const openTurn = this.turns.at(-1);
    if (!openTurn || openTurn.darts.length === 0) return false;

    openTurn.darts.pop();
    if (openTurn.darts.length === 0) {
      this.turns.pop();
    } else {
      openTurn.totalScore = sumDartScores(openTurn.darts);
    }
    return true;
  }

  /**
   * Answers whether recording `observation` would resolve the open visit
   * into a win or loss, without mutating the fact log or the derived state.
   * Only a visit's 3rd dart can ever complete the session.
   */
  wouldComplete(observation: DartObservation): boolean {
    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") return false;
    if (before.dartsThisVisit.length < 2) return false;

    const after = applyBobs27Dart(this.config, before, observation);
    return after.status !== "IN_PROGRESS";
  }

  isComplete(): boolean {
    return this.deriveState().status !== "IN_PROGRESS";
  }

  state(): Bobs27State {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [STAGE], turns: cloneTurns(this.turns) };
  }
}

export const bobs27EngineFactory: GameEngineFactory<
  Bobs27Snapshot,
  DartObservation,
  Bobs27State
> = {
  rulesetVersionKey: "BOBS27_V1",
  create(config: Bobs27Snapshot, prior?: EngineFacts) {
    return new Bobs27Engine(config, prior);
  },
};

registerEngineFactory(bobs27EngineFactory);
