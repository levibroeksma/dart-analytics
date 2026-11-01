import type { BotPacing, DartbotSeat, SeatFact } from "@lib/types";
import { createDartRng } from "@modules/dartbot/rng.module";
import { skillProfileForLevel } from "@modules/dartbot/skill-profile.module";
import { throwDart } from "@modules/dartbot/throw-engine.module";
import { chooseTarget } from "@modules/dartbot/strategy/x01.strategy.module";
import { checkoutPathFor } from "@modules/game/checkout-path.module";
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

/**
 * The seated DartBot and the folded state when it is the bot's turn on a
 * live, unfinished session; null otherwise.
 */
export function activeBotTurn<
  TState extends { activeParticipantRef: string },
>(context: {
  engine: unknown;
  finished: boolean;
  $store: { game: { seats: readonly SeatFact[] } };
  state(): TState | null;
}): { botSeat: DartbotSeat; state: TState } | null {
  const botSeat = findBotSeat(context.$store.game.seats);
  if (!botSeat || !context.engine || context.finished) return null;
  const state = context.state();
  if (!state || state.activeParticipantRef !== botSeat.participantRef) {
    return null;
  }
  return { botSeat, state };
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
 * The bot's own seat in the folded engine state. Throws when there is no
 * state or the state holds no seat for the bot.
 */
export function botSeatState<TSeat extends { participantRef: string }>(
  state: { seats: readonly TSeat[] } | null,
  botSeat: DartbotSeat,
): TSeat {
  const seatState = state?.seats.find(
    (seat) => seat.participantRef === botSeat.participantRef,
  );
  if (!seatState) {
    throw new Error("DartBot has no seat in this session's engine state");
  }
  return seatState;
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
  return {
    observation: botDartObservationAt(
      botSeat,
      botDartIndex(turns, botSeat.participantRef),
      intent,
    ),
    pacing: BOT_PACING,
  };
}

/**
 * The observation of one bot dart at an explicit `dartIndex`, for a caller
 * whose index is not the fact log's (501's QUICK_SCORE scratch visit).
 */
export function botDartObservationAt(
  botSeat: DartbotSeat,
  dartIndex: number,
  intent: ThrowIntent,
): DartObservation {
  const profile = skillProfileForLevel(botSeat.dartbot.level);
  const rng = createDartRng(botSeat.dartbot.seed, dartIndex);
  const thrown = throwDart(intent, profile, rng);
  return {
    hitTargetNumber: thrown.hit.targetNumber,
    hitZoneKey: thrown.hit.zoneKey,
    locationX: thrown.landing.x,
    locationY: thrown.landing.y,
  };
}

/** The x01 strategy's aim for a bot seat `remaining` short of its finish, at the level's decision quality. */
export function x01BotIntent(
  remaining: number,
  botSeat: DartbotSeat,
): ThrowIntent {
  return chooseTarget(
    { remaining, checkoutPath: checkoutPathFor(remaining) },
    skillProfileForLevel(botSeat.dartbot.level).decisionQuality,
  );
}
