import { aceRoundScores, aceTargetFor } from "@modules/game/ace.engine.module";
import { BULL_TARGET_NUMBER } from "@modules/game/board-progression.module";
import type {
  AceRoundResult,
  AceSeatResult,
  AceSnapshot,
  Seated,
} from "@lib/types";
import type { AceSeatState, EngineFacts } from "@modules/types";

/** A fresh draw seed: a random 32-bit integer, minted once per game. */
export function mintAceDrawSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

/** A round's target as shown: the number, or `Bull`; `—` once the seat has no round left. */
export function aceTargetLabel(target: number | null): string {
  if (target === null) return "—";
  return target === BULL_TARGET_NUMBER ? "Bull" : String(target);
}

/** The target the seat throws at next, `null` after its last round. */
export function aceSeatTarget(
  seat: Pick<AceSeatState, "visits">,
  config: Seated<AceSnapshot>,
): number | null {
  return seat.visits >= config.rounds
    ? null
    : aceTargetFor(config.drawSeed, seat.visits);
}

/** A seat's last closed round as `+9` or `0`; `—` before its first. */
export function aceLastLabel(
  facts: EngineFacts,
  config: Seated<AceSnapshot>,
  participantRef: string,
): string {
  const last = aceRoundScores(facts, config, participantRef).at(-1);
  if (!last) return "—";
  return last.points > 0 ? `+${last.points}` : "0";
}

/** Every round of the game with each seat's points, in seat order. */
export function aceRoundResults(
  facts: EngineFacts,
  config: Seated<AceSnapshot>,
): AceRoundResult[] {
  const perSeat = config.seats.map((seat) =>
    aceRoundScores(facts, config, seat.participantRef),
  );
  return Array.from({ length: config.rounds }, (_, index) => ({
    round: index + 1,
    target: aceTargetFor(config.drawSeed, index),
    points: perSeat.map((rounds) => rounds[index]?.points ?? 0),
  }));
}

/** Projects one folded Ace seat to its stored result row. */
export function aceSeatResult(
  seat: AceSeatState,
  rounds: readonly AceRoundResult[],
  seatIndex: number,
): AceSeatResult {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    total: seat.total,
    scoringVisits: seat.scoringVisits,
    bestRound: Math.max(0, ...rounds.map((round) => round.points[seatIndex])),
  };
}

/** A result row's text: `R3 · 17` for the round and its target, `3 – 1` for the seats' points. */
export function aceRoundRow(round: AceRoundResult): {
  label: string;
  points: string;
} {
  return {
    label: `R${round.round} · ${aceTargetLabel(round.target)}`,
    points: round.points.join(" – "),
  };
}
