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
