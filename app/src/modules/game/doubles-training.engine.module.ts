import type { DoublesTrainingSnapshot } from "@lib/types";
import { newClientKey } from "./client-key.module";
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
  DartFact,
  DartObservation,
  DartZoneKey,
  DoublesTrainingState,
  DoublesVisitOutcome,
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
 * Doubles Training starting state: aimed at DOUBLE 1, no darts thrown yet.
 */
export function initialDoublesTrainingState(): DoublesTrainingState {
  return {
    targetIndex: 0,
    dartsThisVisit: 0,
    outcomes: [],
    status: "IN_PROGRESS",
  };
}

function toHitDartNumber(dartsThisVisit: number): 1 | 2 | 3 {
  if (dartsThisVisit === 1 || dartsThisVisit === 2 || dartsThisVisit === 3) {
    return dartsThisVisit;
  }
  throw new Error(
    `Invalid dartsThisVisit for a hit resolution: ${dartsThisVisit}`,
  );
}

function resolveVisit(
  state: DoublesTrainingState,
  outcomes: DoublesVisitOutcome[],
): DoublesTrainingState {
  if (state.targetIndex === 20) {
    return { ...state, dartsThisVisit: 0, outcomes, status: "COMPLETE" };
  }
  return {
    ...state,
    dartsThisVisit: 0,
    outcomes,
    targetIndex: state.targetIndex + 1,
  };
}

/**
 * Pure reducer: folds one dart observation onto a `DoublesTrainingState`.
 * Unlike Bob's 27 or Singles Training, a visit here resolves the instant any
 * dart hits its double (or `INNER_BULL` on the final target) — the 2nd and
 * 3rd darts are never thrown in that case. A full miss still resolves on the
 * 3rd dart. Either way the visit's outcome is folded into `outcomes` and the
 * path advances; resolving the 21st (last) target in `config.targetOrder`
 * completes the session — not necessarily a BULL visit, since High→Low and
 * Random order modes can put BULL anywhere in the path.
 * `config.mode` still carries exactly one valid value in
 * `DOUBLES_TRAINING_V1` and has no effect on this reducer; only
 * `config.targetOrder` (derived from `order_mode` at session creation) does.
 * @throws when `state.status` is not `IN_PROGRESS`; undo first to correct it.
 */
export function applyDoublesTrainingDart(
  config: DoublesTrainingSnapshot,
  state: DoublesTrainingState,
  observation: DartObservation,
): DoublesTrainingState {
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a dart once the session is complete; undo first to correct it.",
    );
  }

  const target = targetAt(doublesPath(config.targetOrder), state.targetIndex);
  const hit = isHitOn(target, observation);
  const dartsThisVisit = state.dartsThisVisit + 1;

  if (hit) {
    const outcome: DoublesVisitOutcome = {
      targetIndex: state.targetIndex,
      hit: true,
      hitDartNumber: toHitDartNumber(dartsThisVisit),
    };
    return resolveVisit(state, [...state.outcomes, outcome]);
  }

  if (dartsThisVisit < 3) {
    return { ...state, dartsThisVisit };
  }

  const outcome: DoublesVisitOutcome = {
    targetIndex: state.targetIndex,
    hit: false,
    hitDartNumber: null,
  };
  return resolveVisit(state, [...state.outcomes, outcome]);
}

function sumDartScores(darts: readonly DartFact[]): number {
  return darts.reduce((total, dart) => total + dart.score, 0);
}

function cloneTurns(turns: readonly TurnFact[]): TurnFact[] {
  return turns.map((turn) => ({ ...turn, darts: [...turn.darts] }));
}

/**
 * True when `dart`'s actual throw matches the target it was aimed at —
 * exactly the condition `isHitOn` would report for the dart that produced
 * this fact, recovered from the fact's own fields with no path lookup.
 */
function dartHitIntendedTarget(dart: DartFact): boolean {
  return (
    dart.hitTargetNumber === dart.intendedTargetNumber &&
    dart.hitZoneKey === dart.intendedZoneKey
  );
}

/**
 * A visit is still open only while it holds fewer than 3 darts and none of
 * them has hit yet — a hit closes the visit on the spot, so a 1- or 2-dart
 * turn whose last dart hit is just as closed as a full 3-dart turn.
 */
function isVisitOpen(turn: TurnFact): boolean {
  const lastDart = turn.darts.at(-1);
  if (!lastDart) return true;
  return turn.darts.length < 3 && !dartHitIntendedTarget(lastDart);
}

/**
 * Doubles Training: a 21-target path (the 20 doubles and BULL, in the
 * session's configured `target_order`), each visit ending the instant a dart
 * hits its double — the 2nd and 3rd darts are never thrown — or after 3
 * misses. The engine owns the fact log — `state()` derives the
 * current target, in-visit dart count and completion by folding `facts()`
 * through `applyDoublesTrainingDart`; the per-visit `outcomes` (which dart
 * hit, or none) are likewise derived, never stored.
 */
export class DoublesTrainingEngine implements GameEngine<
  DartObservation,
  DoublesTrainingState
> {
  readonly rulesetVersionKey = "DOUBLES_TRAINING_V1";
  private readonly turns: TurnFact[];

  constructor(
    private readonly config: DoublesTrainingSnapshot,
    prior?: EngineFacts,
  ) {
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): DoublesTrainingState {
    let state = initialDoublesTrainingState();
    for (const turn of this.turns) {
      for (const dart of turn.darts) {
        state = applyDoublesTrainingDart(this.config, state, {
          hitTargetNumber: dart.hitTargetNumber,
          hitZoneKey: dart.hitZoneKey,
          locationX: dart.locationX,
          locationY: dart.locationY,
        });
      }
    }
    return state;
  }

  private openOrCreateTurn(): TurnFact {
    const last = this.turns.at(-1);
    if (last && isVisitOpen(last)) return last;

    const turn: TurnFact = {
      clientKey: newClientKey(),
      stageClientKey: STAGE.clientKey,
      sequence: this.turns.length + 1,
      completedAt: null,
      totalScore: 0,
      darts: [],
    };
    this.turns.push(turn);
    return turn;
  }

  /**
   * Appends one dart to the open visit, opening a new one when the last is
   * already resolved — either 3 darts deep or already ended by a hit.
   * `intendedTargetNumber`/`intendedZoneKey` capture the double (or
   * `INNER_BULL` on BULL) this dart was thrown at, ahead of what it actually
   * hit; the fact's `score` is the dart's board score, never a game-specific
   * value. `completedAt` is stamped by the dart that resolves the visit — the
   * client-observed end of it — which here can be a hit on any of the three
   * darts, not only the third.
   * @throws when the session has already ended; the fact log is left untouched.
   */
  record(observation: DartObservation): DoublesTrainingState {
    const before = this.deriveState();
    const target = targetAt(
      doublesPath(this.config.targetOrder),
      before.targetIndex,
    );
    const after = applyDoublesTrainingDart(this.config, before, observation);

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
      locationX: observation.locationX,
      locationY: observation.locationY,
    };

    openTurn.darts.push(dart);
    openTurn.totalScore = sumDartScores(openTurn.darts);
    if (!isVisitOpen(openTurn)) {
      openTurn.completedAt = new Date().toISOString();
    }

    return after;
  }

  /**
   * Pops the last recorded dart, including one replayed from persisted
   * facts, and removes the visit entirely once it holds no darts — the
   * exact inverse of the `record()` call that created it. When that dart was
   * a hit that ended its visit early, popping it leaves the visit's darts
   * below 3 with no hit among them, so `isVisitOpen` reports it open again
   * and the next `record()` resumes it rather than starting a new visit — so
   * its `completedAt` is cleared with it.
   * @returns true if a dart was removed; false if there was nothing to undo.
   */
  undo(): boolean {
    const openTurn = this.turns.at(-1);
    if (!openTurn || openTurn.darts.length === 0) return false;

    openTurn.darts.pop();
    if (openTurn.darts.length === 0) {
      this.turns.pop();
    } else {
      openTurn.completedAt = null;
      openTurn.totalScore = sumDartScores(openTurn.darts);
    }
    return true;
  }

  /**
   * Answers whether recording `observation` would complete the session,
   * without mutating the fact log or the derived state. Unlike Bob's 27 or
   * Singles Training, a hit can complete the session on any of a visit's 3
   * darts, so this simply replays the reducer once and checks the result.
   */
  wouldComplete(observation: DartObservation): boolean {
    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") return false;

    const after = applyDoublesTrainingDart(this.config, before, observation);
    return after.status !== "IN_PROGRESS";
  }

  isComplete(): boolean {
    return this.deriveState().status !== "IN_PROGRESS";
  }

  state(): DoublesTrainingState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const doublesTrainingEngineFactory: GameEngineFactory<
  DoublesTrainingSnapshot,
  DartObservation,
  DoublesTrainingState
> = {
  rulesetVersionKey: "DOUBLES_TRAINING_V1",
  create(config: DoublesTrainingSnapshot, prior?: EngineFacts) {
    return new DoublesTrainingEngine(config, prior);
  },
};

registerEngineFactory(doublesTrainingEngineFactory);
