import {
  DARTS_PER_VISIT,
  MARKS_TO_CLOSE,
  tallyMarksDart,
} from "./marks-close.module";
import { activeSeat, seatOf } from "./seat-rota.module";
import { foldSeatStates, toObservation } from "./seat-state.module";
import { refuseWhenEnded } from "./turn-log.module";
import type { SeatFact } from "@lib/types";
import type {
  DartObservation,
  EngineFacts,
  MarksDuelFold,
  MarksDuelSeat,
  MarksDuelSpec,
  MarksGameState,
  MarksHit,
  TurnFact,
} from "./types";

function applyDuelDart<TSeat extends MarksDuelSeat>(
  seat: TSeat,
  opponent: TSeat,
  hit: MarksHit,
  valueOf: (objectiveIndex: number) => number | null,
): TSeat {
  const { fields, spare } = tallyMarksDart(seat, hit);
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

/**
 * Walks both seats' darts in log order, because a dart's points depend on the
 * opponent's marks at that dart. A dart that leaves its seat closed out with
 * points at least equal to the opponent's wins the game on the spot.
 * @throws when a dart follows the winning one.
 */
export function foldMarksDuel<TSeat extends MarksDuelSeat>(
  turns: readonly TurnFact[],
  seats: readonly [SeatFact, SeatFact],
  spec: MarksDuelSpec<TSeat>,
): MarksDuelFold<TSeat> {
  const states = seats.map(spec.initialSeat);
  let winnerParticipantRef: string | null = null;
  for (const turn of turns) {
    const index = seats.indexOf(seatOf(turn, seats));
    for (const dart of turn.darts) {
      refuseWhenEnded(winnerParticipantRef !== null, "game has ended");
      const opponent = states[1 - index];
      const next = applyDuelDart(
        states[index],
        opponent,
        spec.hitOf(states[index], opponent, toObservation(dart)),
        spec.valueOf,
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
 * Folds a marks game's whole fact log: one seat through `applyDart`, complete
 * once closed out; two seats through `foldMarksDuel`, complete once a seat
 * closes out with points at least equal to its opponent's, and the active
 * seat is then the winner.
 */
export function foldMarksSeats<TSeat extends MarksDuelSeat>(
  facts: EngineFacts,
  seats: readonly SeatFact[],
  spec: MarksDuelSpec<TSeat>,
  applyDart: (seat: TSeat, observation: DartObservation) => TSeat,
): MarksGameState<TSeat> {
  const turnParticipantRef = activeSeat(
    facts,
    seats,
    "PER_SEAT",
  ).participantRef;
  if (seats.length === 2) {
    const duel = foldMarksDuel(facts.turns, [seats[0], seats[1]], spec);
    return {
      activeParticipantRef: duel.winnerParticipantRef ?? turnParticipantRef,
      status: duel.winnerParticipantRef === null ? "IN_PROGRESS" : "COMPLETE",
      winnerParticipantRef: duel.winnerParticipantRef,
      seats: duel.seats,
    };
  }
  const folded = foldSeatStates(
    facts.turns,
    seats,
    spec.initialSeat,
    applyDart,
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
