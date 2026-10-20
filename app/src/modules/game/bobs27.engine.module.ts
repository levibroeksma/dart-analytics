import type { Bobs27Snapshot, Seated } from "@lib/types";
import {
  boardScore,
  doublesPath,
  isHitOn,
  targetAt,
} from "./board-progression.module";
import { registerEngineFactory } from "./engine.registry";
import { activeSeat } from "./seat-rota.module";
import { activeSeatState } from "./seat-state.module";
import { doubleTargetIntent } from "./turn-log.module";
import { eliminationWinner, scoreCompareOutcome } from "./match-outcome.module";
import {
  dartGameEngineClass,
  dartGameEngineFactory,
} from "./dart-engine-shell.module";
import { applyTrackDart, foldTrackSeats } from "./track-kernel.module";
import {
  advanceToEnd,
  closeAfter,
  outAtOrBelowZero,
  pathTarget,
  penaltyOnBlank,
} from "./track-policies";
import type { DartGameSpec, TrackRules } from "./interfaces";
import type {
  BoardTarget,
  Bobs27SeatState,
  Bobs27State,
  Bobs27TrackExt,
  DartObservation,
  EngineFacts,
  TrackSeat,
} from "./types";

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

const MATCH_ENDED =
  "Cannot record a dart once the match has ended; undo first to correct it.";
const GAME_ENDED =
  "Cannot record a dart once the game has ended; undo first to correct it.";

const PATH = doublesPath();

const TO_TRACK = {
  IN_PROGRESS: "IN_PROGRESS",
  WON: "DONE",
  LOST: "OUT",
} as const;
const FROM_TRACK = {
  IN_PROGRESS: "IN_PROGRESS",
  DONE: "WON",
  OUT: "LOST",
} as const;

/**
 * Bob's 27 as Track policies: D1 → BULL, a hit scores the target's value, a
 * blank visit costs that value × the miss multiplier; at or below zero is
 * out, before clearing BULL is checked.
 */
function bobs27Rules(config: Bobs27Snapshot): TrackRules<Bobs27TrackExt> {
  const target = pathTarget<Bobs27TrackExt>(PATH);
  const penalise = penaltyOnBlank<Bobs27TrackExt>(
    (seat) => pointValueOf(target(seat), config) * config.missPenaltyMultiplier,
  );
  const advance = advanceToEnd<Bobs27TrackExt>(PATH.length - 1);
  return {
    doneMessage: GAME_ENDED,
    startScore: config.startScore,
    target,
    hit: isHitOn,
    points: (aimed, _observation, hit) =>
      hit ? pointValueOf(aimed, config) : 0,
    onDart: (seat, dart) => ({
      ...seat,
      ext: { hits: [...seat.ext.hits, dart.hit] },
    }),
    visitOpen: closeAfter(3),
    onVisitClose: (seat) => {
      const judged = outAtOrBelowZero(penalise(seat));
      const next = judged.status === "OUT" ? judged : advance(judged);
      return { ...next, ext: { hits: [] } };
    },
  };
}

/** Lifts a Bob's 27 seat into the kernel's shape; the visit counters are read off its hit list. */
function toTrackSeat(state: Bobs27SeatState): TrackSeat<Bobs27TrackExt> {
  return {
    participantRef: state.participantRef,
    sideKey: state.sideKey,
    targetIndex: state.targetIndex,
    score: state.score,
    dartsThisVisit: state.dartsThisVisit.length,
    hitsThisVisit: state.dartsThisVisit.filter(Boolean).length,
    status: TO_TRACK[state.status],
    ext: { hits: state.dartsThisVisit },
  };
}

/** Projects a kernel seat back to Bob's 27's seat state. */
function toBobs27Seat(seat: TrackSeat<Bobs27TrackExt>): Bobs27SeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    targetIndex: seat.targetIndex,
    score: seat.score,
    dartsThisVisit: seat.ext.hits,
    status: FROM_TRACK[seat.status],
  };
}

/**
 * Pure reducer, via the Track kernel: folds one dart observation onto one seat's `Bobs27SeatState`.
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
  return toBobs27Seat(
    applyTrackDart(toTrackSeat(state), observation, bobs27Rules(config)),
  );
}

function elimination(
  seats: readonly Bobs27SeatState[],
): Pick<Bobs27State, "status" | "winningSideKey"> {
  const winningSideKey = eliminationWinner(
    seats.map((seat) => ({
      sideKey: seat.sideKey,
      failed: seat.status === "LOST",
    })),
  );
  return {
    status: winningSideKey !== null ? "COMPLETE" : "IN_PROGRESS",
    winningSideKey,
  };
}

/**
 * Folds the whole fact log into the session's state — the function the
 * engine's own `deriveState()` delegates to, and the play controller's own
 * `state()` folds directly against `$store.game`'s reactive fields, exactly
 * like `foldTuodState`/`foldFiveOhOneState`. Elimination: the first seat to
 * bust loses and the match ends immediately, the other seat winning. When
 * every seat survives the bull, the higher final score wins and equal scores
 * are a `TIE`.
 */
export function foldBobs27State(
  facts: EngineFacts,
  config: Seated<Bobs27Snapshot>,
): Bobs27State {
  const seats = foldTrackSeats(
    facts.turns,
    config.seats,
    () => ({ hits: [] }),
    bobs27Rules(config),
  ).map(toBobs27Seat);

  const anyLost = seats.some((seat) => seat.status === "LOST");
  const {
    status,
    winningSideKey,
  }: Pick<Bobs27State, "status" | "winningSideKey"> =
    seats.length === 1
      ? { status: seats[0].status, winningSideKey: null }
      : anyLost
        ? elimination(seats)
        : scoreCompareOutcome(
            seats.map((seat) => ({
              sideKey: seat.sideKey,
              completed: seat.status === "WON",
              metric: seat.score,
            })),
            "HIGHEST",
            "IN_PROGRESS",
          );

  return {
    activeParticipantRef: activeSeat(facts, config.seats, "PER_SEAT")
      .participantRef,
    status,
    winningSideKey,
    seats,
  };
}

/**
 * Bob's 27's rules for the dart engine shell: three darts at each double in
 * turn, D1 to BULL; elimination when a seat's derived score drops to zero
 * or below. Only a visit's 3rd dart can end a seat.
 */
const bobs27Spec: DartGameSpec<Seated<Bobs27Snapshot>, Bobs27State> = {
  rulesetVersionKey: "BOBS27_V1",
  stageOwnership: "PER_SEAT",
  fold: foldBobs27State,
  refusal: (state) => {
    if (state.status !== "IN_PROGRESS") return MATCH_ENDED;
    return activeSeatState(state).status === "IN_PROGRESS" ? null : GAME_ENDED;
  },
  intent: (state) =>
    doubleTargetIntent(
      targetAt(doublesPath(), activeSeatState(state).targetIndex),
    ),
  isVisitOpen: (turn) => turn.darts.length < 3,
  wouldComplete: (state, observation, config) => {
    if (state.status !== "IN_PROGRESS") return false;
    const seat = activeSeatState(state);
    if (seat.status !== "IN_PROGRESS") return false;
    if (seat.dartsThisVisit.length < 2) return false;
    return applyBobs27Dart(config, seat, observation).status !== "IN_PROGRESS";
  },
};

/** Bob's 27 engine (Pattern 18), built by the dart engine shell. */
export class Bobs27Engine extends dartGameEngineClass(bobs27Spec) {}

export const bobs27EngineFactory = dartGameEngineFactory(
  bobs27Spec,
  Bobs27Engine,
);

registerEngineFactory(bobs27EngineFactory);
