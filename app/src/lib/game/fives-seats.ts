import { foldVisitPoints } from "@modules/game/visit-points-kernel.module";
import { FIVES_RULES } from "@modules/game/fives.engine.module";
import type { FivesLastVisit, FivesSeatResult } from "@lib/types";
import type { FivesSeatState, TurnFact } from "@modules/types";

/** Projects one folded Fives seat to its stored result row. */
export function fivesSeatResult(seat: FivesSeatState): FivesSeatResult {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    total: seat.total,
    visits: seat.visits,
    scoringVisits: seat.scoringVisits,
    voids: seat.voids,
    busts: seat.busts,
  };
}

/**
 * A seat's last closed (three-dart) visit and how it scored, read by folding
 * the seat's closed visits with and without it; null before the first one.
 * The open visit is not a visit yet.
 */
export function fivesLastVisit(
  turns: readonly TurnFact[],
  participantRef: string,
): FivesLastVisit | null {
  const closed = turns.filter(
    (turn) =>
      turn.participantRef === participantRef &&
      turn.darts.length >= FIVES_RULES.dartsPerVisit,
  );
  const last = closed.at(-1);
  if (!last) return null;
  const before = foldVisitPoints(closed.slice(0, -1), FIVES_RULES);
  const after = foldVisitPoints(closed, FIVES_RULES);
  const points = after.points - before.points;
  const kind =
    after.voids > before.voids
      ? "VOID"
      : after.busts > before.busts
        ? "BUST"
        : points > 0
          ? "SCORE"
          : "ZERO";
  return {
    total: last.darts.reduce((sum, dart) => sum + dart.score, 0),
    points,
    kind,
  };
}

/** The last-visit tile text: `Void`, `Bust`, `+9` or `0`; `—` before a first visit. */
export function fivesLastVisitLabel(visit: FivesLastVisit | null): string {
  if (!visit) return "—";
  if (visit.kind === "VOID") return "Void";
  if (visit.kind === "BUST") return "Bust";
  return visit.kind === "SCORE" ? `+${visit.points}` : "0";
}
