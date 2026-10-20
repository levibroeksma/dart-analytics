import type { BotPacing, DartbotSeat, SeatFact } from "@lib/types";
import type { TurnFact } from "@modules/types";

/** The DartBot's per-dart pacing in every game: think, then hold the landed dart (08-DartBot.md). */
export const BOT_PACING: BotPacing = Object.freeze({
  preThrowMs: 900,
  postThrowMs: 250,
});

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
