import type { RulesetVersionKey, SeatFact } from "@lib/types";
import {
  applyMarksDart,
  DARTS_PER_VISIT,
  MARKS_TO_CLOSE,
  tallyMarksDart,
} from "./marks-close.module";
import { activeSeat, seatOf } from "./seat-rota.module";
import { foldSeatStates, toObservation } from "./seat-state.module";
import { endedRefusal, NO_INTENT, refuseWhenEnded } from "./turn-log.module";
import type { DartGameSpec } from "./interfaces";
import type {
  DartObservation,
  EngineFacts,
  MarksDuelFold,
  MarksDuelSeat,
  MarksGameState,
  MarksHit,
  MarksRules,
  TurnFact,
} from "./types";

const GAME_ENDED = endedRefusal("game has ended");

function applyDuelDart<TSeat extends MarksDuelSeat>(
  seat: TSeat,
  opponent: TSeat,
  hit: MarksHit,
  dip: MarksHit,
  valueOf: (objectiveIndex: number) => number | null,
): TSeat {
  const { fields, spare } = tallyMarksDart(seat, hit, dip);
  const value =
    hit && opponent.marks[hit.objectiveIndex] < MARKS_TO_CLOSE
      ? valueOf(hit.objectiveIndex)
      : null;
  const visitDarts = seat.dartsThisVisit + 1;
  return {
    ...seat,
    ...fields,
    points: seat.points + (value === null ? 0 : spare * value),
    dartsThisVisit: visitDarts === DARTS_PER_VISIT ? 0 : visitDarts,
    status: fields.marks.every((count) => count === MARKS_TO_CLOSE)
      ? "COMPLETE"
      : "IN_PROGRESS",
  };
}

/** Applies one dart to a seat on its own, with no opponent to score against. */
function soloDart<TSeat extends MarksDuelSeat>(
  seat: TSeat,
  observation: DartObservation,
  rules: MarksRules<TSeat>,
): TSeat {
  return {
    ...seat,
    ...applyMarksDart(
      seat,
      rules.hitOf(seat, null, observation),
      rules.dipOf?.(seat, observation) ?? null,
    ),
  };
}

/**
 * Walks both seats' darts in log order, because a dart's points depend on the
 * opponent's marks at that dart. A dart that leaves its seat closed out with
 * points at least equal to the opponent's wins the game on the spot.
 * @throws when a dart follows the winning one.
 */
export function foldMarksDuel<TSeat extends MarksDuelSeat>(
  turns: readonly TurnFact[],
  seats: readonly [SeatFact, SeatFact],
  rules: MarksRules<TSeat>,
): MarksDuelFold<TSeat> {
  const states = seats.map(rules.initialSeat);
  let winnerParticipantRef: string | null = null;
  for (const turn of turns) {
    const index = seats.indexOf(seatOf(turn, seats));
    for (const dart of turn.darts) {
      refuseWhenEnded(winnerParticipantRef !== null, "game has ended");
      const opponent = states[1 - index];
      const next = applyDuelDart(
        states[index],
        opponent,
        rules.hitOf(states[index], opponent, toObservation(dart)),
        rules.dipOf?.(states[index], toObservation(dart)) ?? null,
        rules.valueOf,
      );
      states[index] = next;
      if (next.status === "COMPLETE" && next.points >= opponent.points) {
        states[index] = { ...next, dartsThisVisit: 0 };
        winnerParticipantRef = next.participantRef;
      }
    }
  }
  return { seats: states, winnerParticipantRef };
}

/**
 * Folds a marks game's whole fact log: one seat on its own, complete once
 * closed out; two seats through `foldMarksDuel`, complete once a seat closes
 * out with points at least equal to its opponent's, and the active seat is
 * then the winner.
 */
export function foldMarks<TSeat extends MarksDuelSeat>(
  facts: EngineFacts,
  seats: readonly SeatFact[],
  rules: MarksRules<TSeat>,
): MarksGameState<TSeat> {
  const turnParticipantRef = activeSeat(
    facts,
    seats,
    "PER_SEAT",
  ).participantRef;
  if (seats.length === 2) {
    const duel = foldMarksDuel(facts.turns, [seats[0], seats[1]], rules);
    return {
      activeParticipantRef: duel.winnerParticipantRef ?? turnParticipantRef,
      status: duel.winnerParticipantRef === null ? "IN_PROGRESS" : "COMPLETE",
      winnerParticipantRef: duel.winnerParticipantRef,
      seats: duel.seats,
    };
  }
  const folded = foldSeatStates(facts.turns, seats, rules.initialSeat, (s, o) =>
    soloDart(s, o, rules),
  );
  return {
    activeParticipantRef: turnParticipantRef,
    status: folded.every((seat) => seat.status === "COMPLETE")
      ? "COMPLETE"
      : "IN_PROGRESS",
    winnerParticipantRef: null,
    seats: folded,
  };
}

/**
 * Whether one more dart by the active seat ends the game: alone, it closes
 * the seat out while every other seat is already complete; in a duel, it
 * leaves the thrower closed out with points at least equal to the
 * opponent's. False once the game has ended, or when the active seat is
 * already closed out.
 */
export function marksWouldComplete<TSeat extends MarksDuelSeat>(
  state: MarksGameState<TSeat>,
  observation: DartObservation,
  rules: MarksRules<TSeat>,
): boolean {
  if (state.status !== "IN_PROGRESS") return false;
  const index = state.seats.findIndex(
    (seat) => seat.participantRef === state.activeParticipantRef,
  );
  const seat = state.seats[index];
  if (state.seats.length === 2) {
    const opponent = state.seats[1 - index];
    const next = applyDuelDart(
      seat,
      opponent,
      rules.hitOf(seat, opponent, observation),
      rules.dipOf?.(seat, observation) ?? null,
      rules.valueOf,
    );
    return next.status === "COMPLETE" && next.points >= opponent.points;
  }
  return (
    seat.status !== "COMPLETE" &&
    soloDart(seat, observation, rules).status === "COMPLETE" &&
    state.seats.every((other, i) => i === index || other.status === "COMPLETE")
  );
}

/**
 * A marks game as a game-shell spec: per-seat visits of up to three darts
 * that carry no intent, closed early by the dart that ends the game, which
 * refuses every dart after it.
 */
export function marksGameSpec<
  TConfig extends { seats: readonly SeatFact[] },
  TSeat extends MarksDuelSeat,
>(opts: {
  rulesetVersionKey: RulesetVersionKey;
  rulesetVersionKeys: readonly RulesetVersionKey[];
  rules: MarksRules<TSeat>;
}): DartGameSpec<TConfig, MarksGameState<TSeat>> {
  return {
    rulesetVersionKey: opts.rulesetVersionKey,
    rulesetVersionKeys: opts.rulesetVersionKeys,
    stageOwnership: "PER_SEAT",
    fold: (facts, config) => foldMarks(facts, config.seats, opts.rules),
    refusal: (state) => (state.status === "COMPLETE" ? GAME_ENDED : null),
    intent: () => NO_INTENT,
    isVisitOpen: (turn, state) =>
      turn.completedAt === null &&
      turn.darts.length < DARTS_PER_VISIT &&
      state.status !== "COMPLETE",
    wouldComplete: (state, input) =>
      marksWouldComplete(state, input, opts.rules),
  };
}
