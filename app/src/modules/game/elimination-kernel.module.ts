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
function initialSeats<TExt, TShared>(
  seats: readonly SeatFact[],
  rules: EliminationRules<TExt, TShared>,
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
  rules: EliminationRules<TExt, unknown>,
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

/** Whose visit it is: seat 0 first, an open visit's thrower, else the override or the next seat still in. */
function activeSeat<TExt, TShared>(
  seats: readonly EliminationSeat<TExt>[],
  turns: readonly TurnFact[],
  shared: TShared,
  rules: EliminationRules<TExt, TShared>,
): string {
  const last = turns.at(-1);
  if (!last) return seats[0].participantRef;
  if (last.completedAt === null) return last.participantRef;
  return (
    rules.activeOverride?.(seats, shared) ??
    nextSeatIn(seats, last.participantRef)
  );
}

/** Seats with `changes` applied in order, and the refs that went out because of them. */
function applyChanges<TExt>(
  seats: EliminationSeat<TExt>[],
  changes: readonly SeatChange<TExt>[],
): { seats: EliminationSeat<TExt>[]; newlyOut: string[] } {
  const after = changes.reduce<EliminationSeat<TExt>[]>(
    (acc, change) => acc.map((seat) => applyChange(seat, change)),
    seats,
  );
  const newlyOut = after
    .filter((seat, i) => seat.out && !seats[i].out)
    .map((seat) => seat.participantRef);
  return { seats: after, newlyOut };
}

/** The seats and shared after one dart; `reduceDart`, when present, replaces `onDart` and also moves `shared`. */
function foldDart<TExt, TShared>(
  state: { seats: EliminationSeat<TExt>[]; shared: TShared },
  throwerRef: string,
  dart: DartObservation,
  rules: EliminationRules<TExt, TShared>,
): { seats: EliminationSeat<TExt>[]; shared: TShared; newlyOut: string[] } {
  if (!rules.reduceDart) {
    const after = applyEliminationDart(state.seats, throwerRef, dart, rules);
    const newlyOut = after
      .filter((seat, i) => seat.out && !state.seats[i].out)
      .map((seat) => seat.participantRef);
    return { seats: after, shared: state.shared, newlyOut };
  }
  const thrower = state.seats.find(
    (seat) => seat.participantRef === throwerRef,
  );
  if (!thrower) throw new Error(`Unknown thrower ${throwerRef}`);
  const outcome = rules.reduceDart(thrower, state.seats, state.shared, dart);
  const applied = applyChanges([...state.seats], outcome.changes);
  return { ...applied, shared: outcome.shared };
}

/**
 * Folds every dart of every turn, the open one included, into an
 * Elimination match. A visit is open while its turn has no `completedAt`;
 * a closed one also runs the ruleset's `onVisitClose`.
 */
export function foldElimination<TExt, TShared = undefined>(
  turns: readonly TurnFact[],
  seatFacts: readonly SeatFact[],
  rules: EliminationRules<TExt, TShared>,
): EliminationMatch<TExt, TShared> {
  let seats = initialSeats(seatFacts, rules);
  let shared = rules.initShared?.(seatFacts) as TShared;
  const outOrder: string[] = [];
  for (const turn of turns) {
    for (const dart of turn.darts) {
      const step = foldDart(
        { seats, shared },
        turn.participantRef,
        dart,
        rules,
      );
      outOrder.push(...step.newlyOut);
      seats = step.seats;
      shared = step.shared;
    }
    if (turn.completedAt !== null && rules.onVisitClose) {
      const outcome = rules.onVisitClose(
        {
          participantRef: turn.participantRef,
          darts: turn.darts,
          kept: turn.kept ?? false,
        },
        seats,
        shared,
      );
      const applied = applyChanges(seats, outcome.changes);
      outOrder.push(...applied.newlyOut);
      seats = applied.seats;
      shared = outcome.shared;
    }
  }
  const winningSideKey =
    rules.decidedWinner?.(seats, shared) ??
    eliminationWinner(
      seats.map((seat) => ({ sideKey: seat.sideKey, failed: seat.out })),
    );
  return {
    seats,
    shared,
    outOrder,
    status: winningSideKey === null ? "IN_PROGRESS" : "COMPLETE",
    winningSideKey,
    activeParticipantRef: activeSeat(seats, turns, shared, rules),
  };
}
