import type { AroundTheClockSnapshot, Seated, SeatFact } from "@lib/types";
import { newClientKey } from "./client-key.module";
import {
  BULL_TARGET_NUMBER,
  boardScore,
  numbersPath,
  targetAt,
} from "./board-progression.module";
import { registerEngineFactory } from "./engine.registry";
import { activeSeat } from "./seat-rota.module";
import { scoreCompareWinner } from "./match-outcome.module";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  AroundTheClockSeatState,
  AroundTheClockState,
  BoardTarget,
  DartFact,
  DartObservation,
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

const LAST_TARGET_INDEX = 20;

function initialSeatState(seat: SeatFact): AroundTheClockSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    targetIndex: 0,
    dartsThisVisit: 0,
    status: "IN_PROGRESS",
  };
}

/** Around the Clock starting state: every configured seat aimed at NUMBER 1, no darts thrown. */
export function initialAroundTheClockState(
  config: Seated<AroundTheClockSnapshot>,
): AroundTheClockState {
  return {
    activeParticipantRef: config.seats[0].participantRef,
    status: "IN_PROGRESS",
    winningSideKey: null,
    seats: config.seats.map(initialSeatState),
  };
}

export function isAroundTheClockHit(
  target: BoardTarget,
  observation: DartObservation,
): boolean {
  if (target.kind === "BULL") {
    return (
      observation.hitTargetNumber === BULL_TARGET_NUMBER &&
      (observation.hitZoneKey === "OUTER_BULL" ||
        observation.hitZoneKey === "INNER_BULL")
    );
  }
  return (
    observation.hitTargetNumber === target.number &&
    observation.hitZoneKey !== "MISS"
  );
}

/**
 * Pure reducer: folds one dart observation onto one seat's
 * `AroundTheClockSeatState`. A hit advances the target immediately, mid
 * -visit. A hit on the BULL target (index 20) completes that seat's own
 * circuit immediately, whatever `dartsThisVisit` currently is. Otherwise the
 * visit closes (`dartsThisVisit` resets to 0) once it reaches 3 darts.
 * @throws when `state.status` is not `IN_PROGRESS`; undo first to correct it.
 */
export function applyAroundTheClockDart(
  state: AroundTheClockSeatState,
  observation: DartObservation,
): AroundTheClockSeatState {
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a dart once the session has ended; undo first to correct it.",
    );
  }

  const target = targetAt(numbersPath(), state.targetIndex);
  const hit = isAroundTheClockHit(target, observation);

  if (hit && state.targetIndex === LAST_TARGET_INDEX) {
    return {
      ...state,
      targetIndex: LAST_TARGET_INDEX,
      dartsThisVisit: 0,
      status: "COMPLETE",
    };
  }

  const targetIndex = hit ? state.targetIndex + 1 : state.targetIndex;
  const dartsThisVisit =
    state.dartsThisVisit + 1 === 3 ? 0 : state.dartsThisVisit + 1;
  return { ...state, targetIndex, dartsThisVisit, status: "IN_PROGRESS" };
}

function sumDartScores(darts: readonly DartFact[]): number {
  return darts.reduce((total, dart) => total + dart.score, 0);
}

function cloneTurns(turns: readonly TurnFact[]): TurnFact[] {
  return turns.map((turn) => ({ ...turn, darts: [...turn.darts] }));
}

function dartsThrownBy(
  seat: Pick<SeatFact, "participantRef">,
  turns: readonly TurnFact[],
): number {
  return turns
    .filter((turn) => turn.participantRef === seat.participantRef)
    .reduce((sum, turn) => sum + turn.darts.length, 0);
}

/**
 * Folds the whole fact log into the session's state — the same function the
 * engine's own `deriveState()` delegates to and the play page calls
 * directly for reactive display, mirroring `foldOneTwentyOneState`.
 *
 * Score-compare, fewest darts wins: both seats always play out their own
 * full circuit — a completed seat is skipped by `activeSeat`'s completion
 * predicate, handing every remaining turn to the other, so a miss's extra
 * visit never steals a turn from a seat that has already finished. The
 * match resolves only once both seats are `COMPLETE`.
 */
export function foldAroundTheClockState(
  facts: EngineFacts,
  config: Seated<AroundTheClockSnapshot>,
): AroundTheClockState {
  const seats = config.seats.map((seat) => {
    let state = initialSeatState(seat);
    const seatTurns = facts.turns.filter(
      (turn) => turn.participantRef === seat.participantRef,
    );
    for (const turn of seatTurns) {
      for (const dart of turn.darts) {
        state = applyAroundTheClockDart(state, {
          hitTargetNumber: dart.hitTargetNumber,
          hitZoneKey: dart.hitZoneKey,
          locationX: dart.locationX,
          locationY: dart.locationY,
        });
      }
    }
    return state;
  });

  const winningSideKey =
    seats.length === 1
      ? null
      : scoreCompareWinner(
          seats.map((seat) => ({
            sideKey: seat.sideKey,
            completed: seat.status === "COMPLETE",
            metric: dartsThrownBy(seat, facts.turns),
          })),
          "LOWEST",
        );

  const allComplete = seats.every((seat) => seat.status === "COMPLETE");
  const status: AroundTheClockState["status"] =
    seats.length === 1
      ? seats[0].status
      : !allComplete
        ? "IN_PROGRESS"
        : winningSideKey !== null
          ? "COMPLETE"
          : "TIE";

  return {
    activeParticipantRef: activeSeat(
      facts,
      config.seats,
      "PER_SEAT",
      (candidate) =>
        seats.find((seat) => seat.participantRef === candidate.participantRef)
          ?.status === "COMPLETE",
    ).participantRef,
    status,
    winningSideKey,
    seats,
  };
}

/**
 * Around the Clock: a fixed 21-target path (1..20, then BULL) walked with
 * mid-visit advancement, per seat. Score-compare: both seats always play
 * their whole circuit, then whichever finished in fewer darts wins — a miss
 * costs an extra visit, so seats can finish in different visit counts, which
 * is why `activeSeat` needs the completion predicate this engine passes.
 */
export class AroundTheClockEngine implements GameEngine<
  DartObservation,
  AroundTheClockState
> {
  readonly rulesetVersionKey = "AROUND_THE_CLOCK_V1";
  readonly stageOwnership = "PER_SEAT" as const;
  private readonly turns: TurnFact[];

  constructor(
    private readonly config: Seated<AroundTheClockSnapshot>,
    prior?: EngineFacts,
  ) {
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): AroundTheClockState {
    return foldAroundTheClockState(
      { stages: [{ ...STAGE }], turns: this.turns },
      this.config,
    );
  }

  private openOrCreateTurn(activeParticipantRef: string): TurnFact {
    const last = this.turns.at(-1);
    if (
      last &&
      last.participantRef === activeParticipantRef &&
      last.darts.length < 3
    ) {
      return last;
    }

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
   * Appends one dart to the active seat's open visit, opening a new one when
   * the last is already 3 darts deep, or when it belongs to a different seat
   * — a seat's own completing dart can close its final visit short (1 or 2
   * darts, via an early BULL hit), and that stale, already-`COMPLETE` visit
   * must never be reused as the OTHER seat's next turn just because it also
   * reads fewer than 3 darts. `completedAt` is stamped when the visit
   * resolves: on its 3rd dart, or immediately when this dart completes that
   * seat's own circuit.
   * @throws when the active seat has already completed its own circuit; the
   *   fact log is left untouched.
   */
  record(observation: DartObservation): AroundTheClockState {
    const before = this.deriveState();
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    if (activeSeatState.status !== "IN_PROGRESS") {
      throw new Error(
        "Cannot record a dart once the session has ended; undo first to correct it.",
      );
    }
    const after = applyAroundTheClockDart(activeSeatState, observation);

    const openTurn = this.openOrCreateTurn(before.activeParticipantRef);
    const dart: DartFact = {
      sequence: openTurn.darts.length + 1,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: observation.hitTargetNumber,
      hitZoneKey: observation.hitZoneKey,
      score: boardScore(observation.hitTargetNumber, observation.hitZoneKey),
      locationX: observation.locationX,
      locationY: observation.locationY,
    };

    openTurn.darts.push(dart);
    openTurn.totalScore = sumDartScores(openTurn.darts);
    if (openTurn.darts.length === 3 || after.status === "COMPLETE") {
      openTurn.completedAt = new Date().toISOString();
    }

    return this.deriveState();
  }

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
   * Answers whether recording `observation` would complete the WHOLE
   * session, not merely the active seat's own circuit: for a solo session
   * (the only other seat set is empty) those are the same thing; for 1v1 the
   * match only completes once every other seat has already finished.
   */
  wouldComplete(observation: DartObservation): boolean {
    const before = this.deriveState();
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    if (activeSeatState.status !== "IN_PROGRESS") return false;

    const after = applyAroundTheClockDart(activeSeatState, observation);
    if (after.status !== "COMPLETE") return false;

    return before.seats
      .filter((seat) => seat.participantRef !== activeSeatState.participantRef)
      .every((seat) => seat.status === "COMPLETE");
  }

  isComplete(): boolean {
    return this.deriveState().status !== "IN_PROGRESS";
  }

  state(): AroundTheClockState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const aroundTheClockEngineFactory: GameEngineFactory<
  Seated<AroundTheClockSnapshot>,
  DartObservation,
  AroundTheClockState
> = {
  rulesetVersionKey: "AROUND_THE_CLOCK_V1",
  stageOwnership: "PER_SEAT",
  create(config: Seated<AroundTheClockSnapshot>, prior?: EngineFacts) {
    return new AroundTheClockEngine(config, prior);
  },
};

registerEngineFactory(aroundTheClockEngineFactory);
