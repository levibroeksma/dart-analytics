import type { ShanghaiSnapshot, Seated, SeatFact } from "@lib/types";
import { newClientKey } from "./client-key.module";
import { boardScore, numbersPath, targetAt } from "./board-progression.module";
import { registerEngineFactory } from "./engine.registry";
import { activeSeat } from "./seat-rota.module";
import { raceWinner, scoreCompareWinner } from "./match-outcome.module";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  DartFact,
  DartObservation,
  DartZoneKey,
  EngineFacts,
  ShanghaiSeatState,
  ShanghaiState,
  StageFact,
  TurnFact,
} from "./types";

const STAGE: StageFact = {
  clientKey: "block-1",
  stageTypeKey: "EXERCISE_BLOCK",
  parentClientKey: null,
  sequence: 1,
};
const LAST_TARGET_INDEX = 19;

function initialSeatState(seat: SeatFact): ShanghaiSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    targetIndex: 0,
    totalScore: 0,
    dartsThisVisit: [],
    status: "IN_PROGRESS",
  };
}

/** Shanghai starting state: every configured seat at round 1, zero score, no darts thrown. */
export function initialShanghaiState(
  config: Seated<ShanghaiSnapshot>,
): ShanghaiState {
  return {
    activeParticipantRef: config.seats[0].participantRef,
    status: "IN_PROGRESS",
    winningSideKey: null,
    seats: config.seats.map(initialSeatState),
  };
}

const SINGLE_ZONE_KEYS: ReadonlySet<DartZoneKey> = new Set([
  "SINGLE",
  "INNER_SINGLE",
  "OUTER_SINGLE",
]);

function zoneBucketOf(
  zone: DartZoneKey,
): "SINGLE" | "DOUBLE" | "TREBLE" | null {
  if (SINGLE_ZONE_KEYS.has(zone)) return "SINGLE";
  if (zone === "DOUBLE") return "DOUBLE";
  if (zone === "TREBLE") return "TREBLE";
  return null;
}

function activeNumberAt(targetIndex: number): number {
  const target = targetAt(numbersPath(), targetIndex);
  if (target.kind === "BULL") {
    throw new Error("Shanghai never reaches the BULL target");
  }
  return target.number;
}

function isShanghai(dartsThisVisit: readonly (DartZoneKey | null)[]): boolean {
  const buckets = new Set(
    dartsThisVisit
      .filter((zone): zone is DartZoneKey => zone !== null)
      .map(zoneBucketOf),
  );
  return (
    buckets.has("SINGLE") && buckets.has("DOUBLE") && buckets.has("TREBLE")
  );
}

/**
 * Pure reducer: folds one dart observation onto one seat's `ShanghaiSeatState`.
 * @throws when `state.status` is not `IN_PROGRESS`; undo first to correct it.
 */
export function applyShanghaiDart(
  state: ShanghaiSeatState,
  observation: DartObservation,
): ShanghaiSeatState {
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a dart once the session has ended; undo first to correct it.",
    );
  }

  const targetNumber = activeNumberAt(state.targetIndex);
  const onTarget =
    observation.hitTargetNumber === targetNumber &&
    zoneBucketOf(observation.hitZoneKey) !== null;
  const totalScore = onTarget
    ? state.totalScore + boardScore(targetNumber, observation.hitZoneKey)
    : state.totalScore;
  const dartsThisVisit = [
    ...state.dartsThisVisit,
    onTarget ? observation.hitZoneKey : null,
  ];

  if (dartsThisVisit.length < 3) {
    return { ...state, totalScore, dartsThisVisit };
  }
  if (isShanghai(dartsThisVisit)) {
    return { ...state, totalScore, dartsThisVisit: [], status: "SHANGHAI" };
  }
  if (state.targetIndex === LAST_TARGET_INDEX) {
    return { ...state, totalScore, dartsThisVisit: [], status: "COMPLETE" };
  }
  return {
    ...state,
    totalScore,
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
 * Folds the whole fact log into the session's state, mirroring
 * `foldAroundTheClockState`. Composes `raceWinner` and `scoreCompareWinner`:
 * a Shanghai short-circuits the whole match the instant either seat hits
 * one, whatever the other seat's own round is — this is score-compare's own
 * race-shaped exception. Absent that, the match resolves only once both
 * seats reach `COMPLETE` (all 20 rounds, no Shanghai), by total score.
 */
export function foldShanghaiState(
  facts: EngineFacts,
  config: Seated<ShanghaiSnapshot>,
): ShanghaiState {
  const seats = config.seats.map((seat) => {
    let state = initialSeatState(seat);
    const seatTurns = facts.turns.filter(
      (turn) => turn.participantRef === seat.participantRef,
    );
    for (const turn of seatTurns) {
      for (const dart of turn.darts) {
        state = applyShanghaiDart(state, {
          hitTargetNumber: dart.hitTargetNumber,
          hitZoneKey: dart.hitZoneKey,
          locationX: dart.locationX,
          locationY: dart.locationY,
        });
      }
    }
    return state;
  });

  const raceResult = raceWinner(
    seats.map((seat) => ({
      sideKey: seat.sideKey,
      finished: seat.status === "SHANGHAI",
    })),
  );
  const allTerminal = seats.every((seat) => seat.status !== "IN_PROGRESS");
  const compareResult =
    seats.length > 1 && allTerminal && raceResult === null
      ? scoreCompareWinner(
          seats.map((seat) => ({
            sideKey: seat.sideKey,
            completed: true,
            metric: seat.totalScore,
          })),
          "HIGHEST",
        )
      : null;

  const status: ShanghaiState["status"] =
    seats.length === 1
      ? seats[0].status
      : raceResult !== null
        ? "SHANGHAI"
        : !allTerminal
          ? "IN_PROGRESS"
          : compareResult !== null
            ? "COMPLETE"
            : "TIE";

  return {
    activeParticipantRef: activeSeat(facts, config.seats, "PER_SEAT")
      .participantRef,
    status,
    winningSideKey: raceResult ?? compareResult,
    seats,
  };
}

/**
 * Shanghai: rounds 1..20, three darts each at that round's own number, per
 * seat. A single/double/treble Shanghai on any seat's visit ends the whole
 * match immediately — score-compare's own race-shaped exception. Otherwise
 * both seats always play all 20 rounds, then the higher total score wins.
 */
export class ShanghaiEngine implements GameEngine<
  DartObservation,
  ShanghaiState
> {
  readonly rulesetVersionKey = "SHANGHAI_V1";
  readonly stageOwnership = "PER_SEAT" as const;
  private readonly turns: TurnFact[];

  constructor(
    private readonly config: Seated<ShanghaiSnapshot>,
    prior?: EngineFacts,
  ) {
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): ShanghaiState {
    return foldShanghaiState(
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
   * Appends one dart to the active seat's open visit. Guarded at both
   * scopes: `before.status` catches the instant-Shanghai short circuit,
   * which can end the WHOLE match on one seat's own visit while the OTHER
   * seat's own `status` still reads `IN_PROGRESS` — that seat's own guard
   * alone would let a caller keep recording its turns after the match is
   * already decided. The seat-level guard also stays, for the ordinary
   * single-seat-terminal case a solo session hits directly.
   * @throws when the match has already ended (a Shanghai, or score-compare
   *   once both seats are `COMPLETE`/`TIE`), or the active seat has already
   *   ended its own session; the fact log is left untouched in either case.
   */
  record(observation: DartObservation): ShanghaiState {
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
        "Cannot record a dart once the session has ended; undo first to correct it.",
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
   * either this dart completes a Shanghai (which always ends the match, no
   * matter the other seat's own round), or it is the active seat's last
   * round and every other seat has already reached a terminal status.
   * `before.status` is checked first: once the match has already ended via
   * an earlier Shanghai, the active seat's own status can still read
   * `IN_PROGRESS` (that seat never got to finish its own round), and its own
   * next visit resolving would otherwise misread as newly completing the
   * match, when the match was decided already.
   */
  wouldComplete(observation: DartObservation): boolean {
    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") return false;
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    if (activeSeatState.status !== "IN_PROGRESS") return false;
    if (activeSeatState.dartsThisVisit.length < 2) return false;

    const after = applyShanghaiDart(activeSeatState, observation);
    if (after.status === "SHANGHAI") return true;
    if (after.status !== "COMPLETE") return false;

    return before.seats
      .filter((seat) => seat.participantRef !== activeSeatState.participantRef)
      .every((seat) => seat.status !== "IN_PROGRESS");
  }

  isComplete(): boolean {
    return this.deriveState().status !== "IN_PROGRESS";
  }

  state(): ShanghaiState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const shanghaiEngineFactory: GameEngineFactory<
  Seated<ShanghaiSnapshot>,
  DartObservation,
  ShanghaiState
> = {
  rulesetVersionKey: "SHANGHAI_V1",
  stageOwnership: "PER_SEAT",
  create(config: Seated<ShanghaiSnapshot>, prior?: EngineFacts) {
    return new ShanghaiEngine(config, prior);
  },
};

registerEngineFactory(shanghaiEngineFactory);
