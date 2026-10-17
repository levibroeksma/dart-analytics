import type { Bobs27Snapshot, Seated } from "@lib/types";
import {
  boardScore,
  doublesPath,
  isHitOn,
  targetAt,
} from "@modules/game/board-progression.module";
import { activeSeat } from "@modules/game/seat-rota.module";
import {
  activeSeatState,
  foldSeatStates,
} from "@modules/game/seat-state.module";
import { doubleTargetIntent } from "@modules/game/turn-log.module";
import { eliminationWinner } from "@modules/game/match-outcome.module";
import { dartGameEngineClass } from "@modules/game/dart-engine-shell.module";
import type { DartGameSpec } from "@modules/interfaces";
import type {
  BoardTarget,
  Bobs27SeatState,
  Bobs27State,
  DartObservation,
  EngineFacts,
} from "@modules/types";

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
function initialBobs27State(config: Seated<Bobs27Snapshot>): Bobs27State {
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
function applyBobs27Dart(
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

/**
 * Folds the whole fact log into the session's state — the function the
 * engine's own `deriveState()` delegates to, and the play controller's own
 * `state()` folds directly against `$store.game`'s reactive fields, exactly
 * like `foldTuodState`/`foldFiveOhOneState`. Elimination: the first seat to
 * bust loses and the match ends immediately, the other seat winning.
 */
function foldBobs27State(
  facts: EngineFacts,
  config: Seated<Bobs27Snapshot>,
): Bobs27State {
  const seats = foldSeatStates(
    facts.turns,
    config.seats,
    (seat) => initialSeatState(config, seat),
    (state, observation) => applyBobs27Dart(config, state, observation),
  );

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
    activeParticipantRef: activeSeat(facts, config.seats, "PER_SEAT")
      .participantRef,
    status,
    winningSideKey,
    seats,
  };
}

const MATCH_ENDED =
  "Cannot record a dart once the match has ended; undo first to correct it.";
const GAME_ENDED =
  "Cannot record a dart once the game has ended; undo first to correct it.";

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
export class LegacyBobs27Engine extends dartGameEngineClass(bobs27Spec) {}
