import type { SinglesSnapshot, Seated, SeatFact } from "@lib/types";
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
  BoardTarget,
  DartFact,
  DartObservation,
  DartZoneKey,
  EngineFacts,
  SinglesTrainingSeatState,
  SinglesTrainingState,
  StageFact,
  TurnFact,
} from "./types";

const STAGE: StageFact = {
  clientKey: "block-1",
  stageTypeKey: "EXERCISE_BLOCK",
  parentClientKey: null,
  sequence: 1,
};

function initialSeatState(seat: SeatFact): SinglesTrainingSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    targetIndex: 0,
    totalPoints: 0,
    dartsThisVisit: 0,
    status: "IN_PROGRESS",
  };
}

/** Singles Training starting state: every configured seat aimed at NUMBER 1, no darts thrown. */
export function initialSinglesTrainingState(
  config: Seated<SinglesSnapshot>,
): SinglesTrainingState {
  return {
    activeParticipantRef: config.seats[0].participantRef,
    status: "IN_PROGRESS",
    winningSideKey: null,
    seats: config.seats.map(initialSeatState),
  };
}

/**
 * Every `DartZoneKey` a single ring can produce: the unbanded value keypad
 * capture records, plus the two bands coordinate capture resolves to. Singles
 * Training treats all three as equally valid single hits, differing only from
 * DOUBLE and TREBLE in point value.
 */
const SINGLE_ZONE_KEYS: ReadonlySet<DartZoneKey> = new Set([
  "SINGLE",
  "INNER_SINGLE",
  "OUTER_SINGLE",
]);

function trainingPointsFor(
  target: BoardTarget,
  config: SinglesSnapshot,
  observation: DartObservation,
): number {
  if (target.kind === "BULL") {
    if (observation.hitTargetNumber !== BULL_TARGET_NUMBER) return 0;
    if (observation.hitZoneKey === "OUTER_BULL") return config.pointsSingle;
    if (observation.hitZoneKey === "INNER_BULL") return config.pointsDouble;
    return 0;
  }
  if (observation.hitTargetNumber !== target.number) return 0;
  if (SINGLE_ZONE_KEYS.has(observation.hitZoneKey)) return config.pointsSingle;
  if (observation.hitZoneKey === "DOUBLE") return config.pointsDouble;
  if (observation.hitZoneKey === "TREBLE") return config.pointsTreble;
  return 0;
}

/**
 * Pure reducer: folds one dart observation onto one seat's
 * `SinglesTrainingSeatState`.
 * @throws when `state.status` is not `IN_PROGRESS`; undo first to correct it.
 */
export function applySinglesTrainingDart(
  config: SinglesSnapshot,
  state: SinglesTrainingSeatState,
  observation: DartObservation,
): SinglesTrainingSeatState {
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a dart once the session is complete; undo first to correct it.",
    );
  }

  const target = targetAt(numbersPath(config.targetOrder), state.targetIndex);
  const totalPoints =
    state.totalPoints + trainingPointsFor(target, config, observation);
  const dartsThisVisit = state.dartsThisVisit + 1;

  if (dartsThisVisit < 3) {
    return { ...state, totalPoints, dartsThisVisit };
  }
  if (state.targetIndex === 20) {
    return { ...state, totalPoints, dartsThisVisit: 0, status: "COMPLETE" };
  }
  return {
    ...state,
    totalPoints,
    dartsThisVisit: 0,
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
 * Folds the whole fact log into the session's state, mirroring
 * `foldAroundTheClockState`. Score-compare, highest training-point total
 * wins: unlike Around the Clock, every visit here is exactly 3 darts
 * regardless of hit or miss, so both seats always take the same number of
 * visits and `activeSeat` needs no completion predicate.
 */
function foldSinglesTrainingState(
  facts: EngineFacts,
  config: Seated<SinglesSnapshot>,
): SinglesTrainingState {
  const seats = config.seats.map((seat) => {
    let state = initialSeatState(seat);
    const seatTurns = facts.turns.filter(
      (turn) => turn.participantRef === seat.participantRef,
    );
    for (const turn of seatTurns) {
      for (const dart of turn.darts) {
        state = applySinglesTrainingDart(config, state, {
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
            metric: seat.totalPoints,
          })),
          "HIGHEST",
        );

  const allComplete = seats.every((seat) => seat.status === "COMPLETE");
  const status: SinglesTrainingState["status"] =
    seats.length === 1
      ? seats[0].status
      : !allComplete
        ? "IN_PROGRESS"
        : winningSideKey !== null
          ? "COMPLETE"
          : "TIE";

  return {
    activeParticipantRef: activeSeat(facts, config.seats, "PER_SEAT")
      .participantRef,
    status,
    winningSideKey,
    seats,
  };
}

/**
 * Singles Training: a fixed path of 21 targets (1..20, then BULL), each
 * visit scored by ring quality relative to its own target, per seat.
 * Score-compare: both seats always play the fixed number of visits, then
 * whichever totalled the higher training-point score wins.
 */
export class SinglesTrainingEngine implements GameEngine<
  DartObservation,
  SinglesTrainingState
> {
  readonly rulesetVersionKey = "SINGLES_V1";
  readonly stageOwnership = "PER_SEAT" as const;
  private readonly turns: TurnFact[];

  constructor(
    private readonly config: Seated<SinglesSnapshot>,
    prior?: EngineFacts,
  ) {
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): SinglesTrainingState {
    return foldSinglesTrainingState(
      { stages: [{ ...STAGE }], turns: this.turns },
      this.config,
    );
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
   * Appends one dart to the active seat's open visit. Both
   * `intendedTargetNumber` and `intendedZoneKey` are always `null` — the
   * whole intention pair, not just the zone. Unlike Bob's 27, Singles
   * Training treats single, double and treble on the current segment as
   * equally valid intentional outcomes (differing only in point value), so
   * no single ring is "the" intended one; recording a target number without
   * a ring would still assert an intention the player never held, and a
   * target number with a null zone is rejected outright by
   * `chk_dart_target_consistency` (migration `0007`), which only admits both
   * intention columns NULL or the zone NOT NULL. Nothing analytic is lost:
   * Singles plays exactly one target per visit in a fixed, configured order,
   * so the intended target is always recoverable from the visit index
   * (`targetIndex`) without storing it per dart. Do not restore either
   * field. The fact's `score` is the dart's board score, never the training
   * points the derived total adds. `completedAt` is stamped only by the
   * dart that resolves the visit — the client-observed end of it — so an
   * open visit carries none.
   *
   * Guarded only by the ACTIVE seat's own `status`: every seat's own visit
   * count is fixed (21) and every visit is exactly 3 darts win or miss, so
   * both seats always finish in strict lockstep alternation with no
   * race/instant-win shortcut (unlike `ShanghaiEngine`, whose Shanghai race
   * can end the whole match while the OTHER seat's own status still reads
   * `IN_PROGRESS`) — the match can only ever turn `COMPLETE`/`TIE` once
   * EVERY seat is individually `COMPLETE`, so whichever seat `activeSeat()`
   * names next is necessarily `COMPLETE` too by then, and this check alone
   * throws. No separate match-level guard is needed, unlike
   * `ScoreTrainingEngine.isMatchDecided()` (whose seat state carries no
   * `status` field to check in the first place).
   * @throws when the active seat has already completed its own session; the
   *   fact log is left untouched.
   */
  record(observation: DartObservation): SinglesTrainingState {
    const before = this.deriveState();
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    if (activeSeatState.status !== "IN_PROGRESS") {
      throw new Error(
        "Cannot record a dart once the session is complete; undo first to correct it.",
      );
    }

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
    if (openTurn.darts.length === 3) {
      openTurn.completedAt = new Date().toISOString();
    }

    return this.deriveState();
  }

  /**
   * Pops the last recorded dart, including one replayed from persisted
   * facts, and removes the visit entirely once it holds no darts — the
   * exact inverse of the `record()` call that created it. A surviving visit
   * is open again by definition, so its `completedAt` is cleared.
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
   * Answers whether recording `observation` would end the WHOLE session —
   * this dart is the active seat's 21st target's 3rd dart, and every other
   * seat has already reached COMPLETE.
   */
  wouldComplete(observation: DartObservation): boolean {
    const before = this.deriveState();
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    if (activeSeatState.status !== "IN_PROGRESS") return false;
    if (activeSeatState.dartsThisVisit < 2) return false;

    const after = applySinglesTrainingDart(
      this.config,
      activeSeatState,
      observation,
    );
    if (after.status !== "COMPLETE") return false;

    return before.seats
      .filter((seat) => seat.participantRef !== activeSeatState.participantRef)
      .every((seat) => seat.status === "COMPLETE");
  }

  isComplete(): boolean {
    return this.deriveState().status !== "IN_PROGRESS";
  }

  state(): SinglesTrainingState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const singlesTrainingEngineFactory: GameEngineFactory<
  Seated<SinglesSnapshot>,
  DartObservation,
  SinglesTrainingState
> = {
  rulesetVersionKey: "SINGLES_V1",
  stageOwnership: "PER_SEAT",
  create(config: Seated<SinglesSnapshot>, prior?: EngineFacts) {
    return new SinglesTrainingEngine(config, prior);
  },
};

registerEngineFactory(singlesTrainingEngineFactory);
