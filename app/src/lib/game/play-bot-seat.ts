import type { BotPacing, DartbotSeat, SeatFact } from "@lib/types";
import { createDartRng } from "@modules/dartbot/rng.module";
import { skillProfileForLevel } from "@modules/dartbot/skill-profile.module";
import { throwDart } from "@modules/dartbot/throw-engine.module";
import type { DartObservation, ThrowIntent, TurnFact } from "@modules/types";

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

/**
 * Throws one dart for a DartBot seat at `intent`: the level's skill profile,
 * a generator seeded at the bot's next dart index (re-derived from the fact
 * log, so an undone or resumed visit re-throws identically), and the shared
 * pacing. The game supplies the intent.
 */
export function botThrowObservation(
  botSeat: DartbotSeat,
  turns: readonly TurnFact[],
  intent: ThrowIntent,
): { observation: DartObservation; pacing: BotPacing } {
  const profile = skillProfileForLevel(botSeat.dartbot.level);
  const rng = createDartRng(
    botSeat.dartbot.seed,
    botDartIndex(turns, botSeat.participantRef),
  );
  const thrown = throwDart(intent, profile, rng);
  return {
    observation: {
      hitTargetNumber: thrown.hit.targetNumber,
      hitZoneKey: thrown.hit.zoneKey,
      locationX: thrown.landing.x,
      locationY: thrown.landing.y,
    },
    pacing: BOT_PACING,
  };
}
