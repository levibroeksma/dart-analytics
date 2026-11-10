import type { TurnFact, VisitPointsSeat } from "@modules/types";
import type { VisitPointsRules } from "@modules/interfaces";

/** The seat before any turn: no visits, no points, no open visit. */
const INITIAL_VISIT_POINTS_SEAT: VisitPointsSeat = Object.freeze({
  visits: 0,
  points: 0,
  lastVisitTotal: null,
  openTotal: 0,
  dartsInVisit: 0,
  dartsThrown: 0,
  voids: 0,
  busts: 0,
  scoringVisits: 0,
});

/**
 * The Visit points kernel's one reducer (Pattern 18 §Rule-kernel families).
 * A turn's total is its dart sum, or its stored `totalScore` when it has no
 * darts (a keypad visit). A turn closes at `rules.dartsPerVisit` darts or
 * when dartless, and adds `rules.points(total)` — or `rules.visitPoints` of
 * its darts and the seat's zero-based visit index; a shorter turn is the open
 * visit, counted in `openTotal`/`dartsInVisit` but not yet scored. A visit
 * `rules.voids` marks books nothing; one that would pass `rules.goal` is a
 * bust and books nothing.
 */
export function applyVisitPointsTurn(
  seat: VisitPointsSeat,
  turn: TurnFact,
  rules: VisitPointsRules,
): VisitPointsSeat {
  const darts = turn.darts.length;
  const total =
    darts === 0
      ? turn.totalScore
      : turn.darts.reduce((sum, dart) => sum + dart.score, 0);
  const dartsThrown = seat.dartsThrown + darts;
  if (darts > 0 && darts < rules.dartsPerVisit) {
    return { ...seat, openTotal: total, dartsInVisit: darts, dartsThrown };
  }
  const voided = rules.voids?.(turn.darts) ?? false;
  const earned = voided
    ? 0
    : rules.visitPoints
      ? rules.visitPoints(turn.darts, seat.visits)
      : rules.points(total);
  const busted = rules.goal !== undefined && seat.points + earned > rules.goal;
  const booked = busted ? 0 : earned;
  return {
    visits: seat.visits + 1,
    points: seat.points + booked,
    lastVisitTotal: total,
    openTotal: 0,
    dartsInVisit: 0,
    dartsThrown,
    voids: seat.voids + (voided ? 1 : 0),
    busts: seat.busts + (busted ? 1 : 0),
    scoringVisits: seat.scoringVisits + (booked > 0 ? 1 : 0),
  };
}

/** Folds one seat's turns, in write order, from the initial seat. */
export function foldVisitPoints(
  turns: readonly TurnFact[],
  rules: VisitPointsRules,
): VisitPointsSeat {
  return turns.reduce(
    (seat, turn) => applyVisitPointsTurn(seat, turn, rules),
    INITIAL_VISIT_POINTS_SEAT,
  );
}
