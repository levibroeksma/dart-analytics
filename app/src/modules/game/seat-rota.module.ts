import type { SeatFact } from "@lib/types";
import type { EngineFacts, StageOwnership, TurnFact } from "./types";

/**
 * Which seat starts leg `legIndex` (0-based). The starting seat rotates over
 * SEATS rather than sides, so a 2v2 match alternates A, B, A, B by seat
 * position exactly as a 1v1 does. Deciding leg 1's starter by a throw at the
 * bull is a separate, deferred capture problem.
 */
export function startingSeatFor(legIndex: number, seatCount: number): number {
  return ((legIndex % seatCount) + seatCount) % seatCount;
}

/**
 * The seat that threw `turn`.
 * @throws when the turn carries a ref that is not one of `seats` — a turn
 *   belonging to nobody is silent attribution loss on upload, so it fails
 *   loudly rather than defaulting to seat 0.
 */
export function seatOf(turn: TurnFact, seats: readonly SeatFact[]): SeatFact {
  const seat = seats.find(
    (candidate) => candidate.participantRef === turn.participantRef,
  );
  if (!seat) {
    throw new Error(
      `Turn ${turn.clientKey} names participantRef ${turn.participantRef}, which is not a seat in this session.`,
    );
  }
  return seat;
}

/**
 * Whose throw it is, derived from the fact log and the seat list — never
 * stored, so a page refresh mid-leg restores it with nothing persisted.
 *
 * A visit still open always holds its own seat, whichever stage shape the
 * engine has: the thrower keeps the turn until it resolves. Otherwise a
 * `SHARED` engine counts the visits already thrown in the OPEN stage and
 * offsets them from that stage's own starting seat, so the rotation survives
 * a leg boundary; a `PER_SEAT` engine counts the whole log, because every
 * seat's stages advance in lockstep — except a seat `isSeatComplete` reports
 * finished, which is skipped so every remaining turn goes to whichever seat
 * has not: Around the Clock plays a variable number of visits per seat (a
 * miss costs an extra one), so lockstep alternation alone cannot describe
 * whose throw it is once one seat has already finished. Every other engine
 * either never calls with a real predicate or ends the match before two
 * seats could diverge, so the default `() => false` reproduces the old pure
 * alternation exactly.
 */
export function activeSeat(
  facts: EngineFacts,
  seats: readonly SeatFact[],
  stageOwnership: StageOwnership,
  isSeatComplete: (seat: SeatFact) => boolean = () => false,
): SeatFact {
  const lastTurn = facts.turns.at(-1);
  if (lastTurn && lastTurn.completedAt === null) {
    return seatOf(lastTurn, seats);
  }

  if (stageOwnership === "PER_SEAT") {
    const remaining = seats.filter((seat) => !isSeatComplete(seat));
    const pool = remaining.length > 0 ? remaining : seats;
    return pool[facts.turns.length % pool.length];
  }

  const openStage = facts.stages.at(-1);
  if (!openStage) return seats[0];

  const thrownInStage = facts.turns.filter(
    (turn) => turn.stageClientKey === openStage.clientKey,
  ).length;
  const start = startingSeatFor(openStage.sequence - 1, seats.length);
  return seats[(start + thrownInStage) % seats.length];
}
