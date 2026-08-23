import type { SeatFact } from "@lib/types";
import type {
  DartObservation,
  MultiSeatState,
  SeatState,
  TurnFact,
} from "./types";

/**
 * Replays the whole log, per seat, through a ruleset's own dart reducer —
 * the derivation every dart-fed engine's `deriveState()` opens with. Each
 * seat sees only its own turns, so a 1v1 log folds to two independent seat
 * states and a solo log to one, with no branch on seat count anywhere.
 *
 * Nothing here is stored: `initialSeatState` rebuilds the starting shape on
 * every read and `applyDart` is pure, so the returned array is fresh each
 * call. A ruleset whose unit of progress is the visit rather than the dart
 * (Score Training, TUOD) folds its turns directly instead.
 */
export function foldSeatStates<TSeat>(
  turns: readonly TurnFact[],
  seats: readonly SeatFact[],
  initialSeatState: (seat: SeatFact) => TSeat,
  applyDart: (state: TSeat, observation: DartObservation) => TSeat,
): TSeat[] {
  return seats.map((seat) => {
    let state = initialSeatState(seat);
    const seatTurns = turns.filter(
      (turn) => turn.participantRef === seat.participantRef,
    );
    for (const turn of seatTurns) {
      for (const dart of turn.darts) {
        state = applyDart(state, {
          hitTargetNumber: dart.hitTargetNumber,
          hitZoneKey: dart.hitZoneKey,
          locationX: dart.locationX,
          locationY: dart.locationY,
        });
      }
    }
    return state;
  });
}

/**
 * The derived seat whose throw it is. `activeParticipantRef` is itself
 * derived from the same fold, so the seat it names is always one of
 * `state.seats` — a state that failed that would be a fold bug, not an input
 * a caller can hand in.
 */
export function activeSeatState<TSeat extends SeatState>(
  state: MultiSeatState<TSeat>,
): TSeat {
  return state.seats.find(
    (seat) => seat.participantRef === state.activeParticipantRef,
  )!;
}

/**
 * Whether a duration-bounded seat has used up its own budget. A ROUNDS
 * session ends a seat the moment it has thrown its configured number of
 * turns; a MINUTES session ends every seat together when the wall clock
 * expires, but only once the seat has thrown at least one turn, so an
 * expired timer never completes a session nobody played. Score Training
 * counts visits and TUOD counts attempts; the rule is the same either way.
 */
export function durationSeatComplete(
  duration: { durationType: string; durationValue: number },
  unitCount: number,
  timerExpired: boolean,
): boolean {
  if (duration.durationType === "ROUNDS") {
    return unitCount >= duration.durationValue;
  }
  return timerExpired && unitCount >= 1;
}

/**
 * The `activeSeat` completion predicate for a ruleset whose seats carry no
 * `status` of their own: completion was computed alongside `seats`, position
 * by position, so the predicate looks the candidate up by ref and reads the
 * flag at the same index. A candidate that is not in `seats` is not complete
 * — it has thrown nothing at all.
 */
export function completedByIndex<TSeat extends SeatState>(
  seats: readonly TSeat[],
  completedSeats: readonly boolean[],
): (candidate: SeatFact) => boolean {
  return (candidate) => {
    const index = seats.findIndex(
      (seat) => seat.participantRef === candidate.participantRef,
    );
    return index === -1 ? false : completedSeats[index];
  };
}

/**
 * Whether every seat OTHER than `participantRef` has already finished its own
 * session — what separates "this dart completes the active seat" from "this
 * dart completes the whole match" in a `wouldComplete()`. Solo is vacuously
 * true: there is no other seat to wait for.
 */
export function otherSeatsComplete(
  seats: readonly (SeatState & { status: string })[],
  participantRef: string,
): boolean {
  return seats
    .filter((seat) => seat.participantRef !== participantRef)
    .every((seat) => seat.status === "COMPLETE");
}
