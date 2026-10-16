import type { DartbotSeat, SeatFact } from "@lib/types";
import type { TurnFact } from "@modules/types";

export function findBotSeat(
  seats: readonly SeatFact[],
): DartbotSeat | undefined {
  return seats.find(
    (seat): seat is DartbotSeat => seat.participantTypeKey === "DARTBOT",
  );
}

export function botDartIndex(
  turns: readonly TurnFact[],
  botRef: string,
): number {
  return turns
    .filter((turn) => turn.participantRef === botRef)
    .reduce((sum, turn) => sum + turn.darts.length, 0);
}

/**
 * The bot's next dart index under `QUICK_SCORE`, where a visit uploads as
 * one turn with `darts: []` — counting darts would pin every visit to the
 * same draws. Each prior bot turn reserves a full `dartsPerVisit` block.
 */
export function botQuickScoreDartIndex(
  turns: readonly TurnFact[],
  botRef: string,
  dartsPerVisit: number,
): number {
  return (
    turns.filter((turn) => turn.participantRef === botRef).length *
    dartsPerVisit
  );
}
