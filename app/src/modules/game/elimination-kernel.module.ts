import type { SeatFact } from "@lib/types";
import type { EliminationRules } from "./interfaces";
import { eliminationWinner } from "./match-outcome.module";
import type {
  DartObservation,
  EliminationMatch,
  EliminationSeat,
  SeatChange,
  TurnFact,
} from "./types";

/** Every seat at `startingLives`, none out, `ext` from `initExt`. */
function initialSeats<TExt>(
  seats: readonly SeatFact[],
  rules: EliminationRules<TExt>,
): EliminationSeat<TExt>[] {
  return seats.map((seat, index) => ({
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    lives: rules.startingLives,
    out: false,
    ext: rules.initExt(seat, index),
  }));
}

/** One change applied to one seat; a seat already out takes no change. */
function applyChange<TExt>(
  seat: EliminationSeat<TExt>,
  change: SeatChange<TExt>,
): EliminationSeat<TExt> {
  if (seat.out || seat.participantRef !== change.participantRef) return seat;
  const lives = Math.max(0, seat.lives + (change.livesDelta ?? 0));
  return { ...seat, lives, out: lives === 0, ext: change.ext ?? seat.ext };
}

/**
 * The seats after one dart by `throwerRef`: `onDart`'s changes applied in
 * order. Lives clamp at 0, a seat at 0 is out, and a change to a seat out
 * before the dart is ignored.
 */
export function applyEliminationDart<TExt>(
  seats: readonly EliminationSeat<TExt>[],
  throwerRef: string,
  dart: DartObservation,
  rules: EliminationRules<TExt>,
): EliminationSeat<TExt>[] {
  const thrower = seats.find((seat) => seat.participantRef === throwerRef);
  if (!thrower) throw new Error(`Unknown thrower ${throwerRef}`);
  return rules
    .onDart(thrower, seats, dart)
    .reduce<EliminationSeat<TExt>[]>(
      (acc, change) => acc.map((seat) => applyChange(seat, change)),
      [...seats],
    );
}

/** The first seat after `ref` in seat order, wrapping, that is not out. */
function nextSeatIn<TExt>(
  seats: readonly EliminationSeat<TExt>[],
  ref: string,
): string {
  const from = seats.findIndex((seat) => seat.participantRef === ref);
  for (let step = 1; step <= seats.length; step++) {
    const seat = seats[(from + step) % seats.length];
    if (!seat.out) return seat.participantRef;
  }
  return ref;
}

/** Whose visit it is: seat 0 first, an open visit's thrower, else the next seat still in. */
function activeSeat<TExt>(
  seats: readonly EliminationSeat<TExt>[],
  turns: readonly TurnFact[],
): string {
  const last = turns.at(-1);
  if (!last) return seats[0].participantRef;
  if (last.completedAt === null) return last.participantRef;
  return nextSeatIn(seats, last.participantRef);
}

/**
 * Folds every dart of every turn, the open one included, into an
 * Elimination match. A visit is open while its turn has no `completedAt`.
 */
export function foldElimination<TExt>(
  turns: readonly TurnFact[],
  seatFacts: readonly SeatFact[],
  rules: EliminationRules<TExt>,
): EliminationMatch<TExt> {
  let seats = initialSeats(seatFacts, rules);
  const outOrder: string[] = [];
  for (const turn of turns) {
    for (const dart of turn.darts) {
      const after = applyEliminationDart(
        seats,
        turn.participantRef,
        dart,
        rules,
      );
      after.forEach((seat, i) => {
        if (seat.out && !seats[i].out) outOrder.push(seat.participantRef);
      });
      seats = after;
    }
  }
  const winningSideKey = eliminationWinner(
    seats.map((seat) => ({ sideKey: seat.sideKey, failed: seat.out })),
  );
  return {
    seats,
    outOrder,
    status: winningSideKey === null ? "IN_PROGRESS" : "COMPLETE",
    winningSideKey,
    activeParticipantRef: activeSeat(seats, turns),
  };
}
