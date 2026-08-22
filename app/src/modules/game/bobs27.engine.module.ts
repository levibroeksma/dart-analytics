import type { Bobs27Snapshot, Seated } from "@lib/types";
import { newClientKey } from "./client-key.module";
import {
  BULL_TARGET_NUMBER,
  boardScore,
  doublesPath,
  isHitOn,
  targetAt,
} from "./board-progression.module";
import { registerEngineFactory } from "./engine.registry";
import { activeSeat } from "./seat-rota.module";
import { eliminationWinner } from "./match-outcome.module";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  BoardTarget,
  Bobs27SeatState,
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

/** One seat's starting progress: the ruleset's starting score, aimed at the first double, no darts thrown. */
function initialSeatState(
  config: Bobs27Snapshot,
  seat: { participantRef: string; sideKey: string },
): Bobs27SeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    targetIndex: 0,
    score: config.startScore,
    dartsThisVisit: [],
    status: "IN_PROGRESS",
  };
}

/**
 * Bob's 27 starting state: every configured seat at its own starting
 * progress, seat 0 active, nobody eliminated. A solo session is one seat —
 * no branch anywhere in the engine.
 */
export function initialBobs27State(
  config: Seated<Bobs27Snapshot>,
): Bobs27State {
  return {
    activeParticipantRef: config.seats[0].participantRef,
    status: "IN_PROGRESS",
    winningSideKey: null,
    seats: config.seats.map((seat) => initialSeatState(config, seat)),
  };
}

function pointValueOf(target: BoardTarget, config: Bobs27Snapshot): number {
  return target.kind === "BULL"
    ? config.bullHitValue
    : boardScore(target.number, "DOUBLE");
}

/**
 * Pure reducer: folds one dart observation onto one seat's `Bobs27SeatState`.
 * A hit adds the current target's point value immediately; a visit resolves
 * on its 3rd dart, where a full miss subtracts that value scaled by the
 * ruleset's miss penalty multiplier. Any hit advances to the next target
 * with no penalty. The path ends at BULL: a resolved score at or below zero
 * loses regardless of target, otherwise clearing BULL wins. Operates on one
 * seat at a time — the caller folds it once per seat, filtering `this.turns`
 * on that seat's own `participantRef` first.
 * @throws when `state.status` is not `IN_PROGRESS`; undo first to correct it.
 */
export function applyBobs27Dart(
  config: Bobs27Snapshot,
  state: Bobs27SeatState,
  observation: DartObservation,
): Bobs27SeatState {
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
 * Bob's 27: a fixed path of 21 targets (D1..D20, then BULL) played to a full
 * -hit clear of BULL or a bust at zero. Elimination: the first seat to bust
 * loses and the match ends immediately, the other seat winning — no "wrong
 * player" error is possible, since `record()` always resolves against the
 * derived active seat. The engine owns the fact log — `state()` derives each
 * seat's running score, current target and win/loss status by folding
 * `facts()`, filtered per seat, through `applyBobs27Dart`; none of it is
 * ever stored.
 */
export class Bobs27Engine implements GameEngine<DartObservation, Bobs27State> {
  readonly rulesetVersionKey = "BOBS27_V1";
  readonly stageOwnership = "PER_SEAT" as const;
  private readonly turns: TurnFact[];

  constructor(
    private readonly config: Seated<Bobs27Snapshot>,
    prior?: EngineFacts,
  ) {
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): Bobs27State {
    const seats = this.config.seats.map((seat) => {
      let state = initialSeatState(this.config, seat);
      const seatTurns = this.turns.filter(
        (turn) => turn.participantRef === seat.participantRef,
      );
      for (const turn of seatTurns) {
        for (const dart of turn.darts) {
          state = applyBobs27Dart(this.config, state, {
            hitTargetNumber: dart.hitTargetNumber,
            hitZoneKey: dart.hitZoneKey,
            locationX: dart.locationX,
            locationY: dart.locationY,
          });
        }
      }
      return state;
    });

    const winningSideKey = eliminationWinner(
      seats.map((seat) => ({
        sideKey: seat.sideKey,
        failed: seat.status === "LOST",
      })),
    );
    const status: Bobs27State["status"] =
      seats.length === 1
        ? seats[0].status
        : winningSideKey !== null
          ? "COMPLETE"
          : "IN_PROGRESS";

    return {
      activeParticipantRef: activeSeat(
        { stages: [{ ...STAGE }], turns: this.turns },
        this.config.seats,
        "PER_SEAT",
      ).participantRef,
      status,
      winningSideKey,
      seats,
    };
  }

  private openOrCreateTurn(activeParticipantRef: string): TurnFact {
    const last = this.turns.at(-1);
    if (last && last.darts.length < 3) return last;

    const turn: TurnFact = {
      clientKey: newClientKey(),
      stageClientKey: STAGE.clientKey,
      participantRef: activeParticipantRef,
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
   * already 3 darts deep. `intendedTargetNumber`/`intendedZoneKey` capture
   * the target this dart was thrown at, ahead of what it actually hit; the
   * fact's `score` is the dart's board score, never the game-specific point
   * value the derived running score adds. `completedAt` is stamped only by
   * the dart that resolves the visit — the client-observed end of it — so an
   * open visit carries none. Validated against the derived active seat's own
   * status before anything is written, so a throw here leaves the fact log
   * exactly as it was.
   * @throws when the derived active seat has already ended (WON/LOST); the
   *   fact log is left untouched.
   */
  record(observation: DartObservation): Bobs27State {
    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") {
      throw new Error(
        "Cannot record a dart once the match has ended; undo first to correct it.",
      );
    }
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    if (activeSeatState.status !== "IN_PROGRESS") {
      throw new Error(
        "Cannot record a dart once the game has ended; undo first to correct it.",
      );
    }

    const target = targetAt(doublesPath(), activeSeatState.targetIndex);
    const openTurn = this.openOrCreateTurn(before.activeParticipantRef);
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
    if (openTurn.darts.length === 3) {
      openTurn.completedAt = new Date().toISOString();
    }

    return this.deriveState();
  }

  /**
   * Pops the last recorded dart, including one replayed from persisted
   * facts, and removes the visit entirely once it holds no darts — the
   * exact inverse of the `record()` call that created it. A surviving visit
   * is open again by definition, so its `completedAt` is cleared. No seat
   * -awareness needed: this always operates on the tail of `this.turns`,
   * whichever seat it belongs to.
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
   * Answers whether recording `observation` would resolve the active seat's
   * open visit into a win or loss, without mutating the fact log or the
   * derived state. Only a visit's 3rd dart can ever complete a seat's path.
   */
  wouldComplete(observation: DartObservation): boolean {
    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") return false;
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    if (activeSeatState.status !== "IN_PROGRESS") return false;
    if (activeSeatState.dartsThisVisit.length < 2) return false;

    const after = applyBobs27Dart(this.config, activeSeatState, observation);
    return after.status !== "IN_PROGRESS";
  }

  isComplete(): boolean {
    return this.deriveState().status !== "IN_PROGRESS";
  }

  state(): Bobs27State {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const bobs27EngineFactory: GameEngineFactory<
  Seated<Bobs27Snapshot>,
  DartObservation,
  Bobs27State
> = {
  rulesetVersionKey: "BOBS27_V1",
  stageOwnership: "PER_SEAT",
  create(config: Seated<Bobs27Snapshot>, prior?: EngineFacts) {
    return new Bobs27Engine(config, prior);
  },
};

registerEngineFactory(bobs27EngineFactory);
