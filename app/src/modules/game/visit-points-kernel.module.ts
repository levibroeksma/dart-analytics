import { boardScore } from "./board-progression.module";
import type {
  DartFact,
  DartObservation,
  TurnFact,
  VisitPointsSeat,
} from "@modules/types";
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

/**
 * The darts a visit would hold if `observation` closed it: the open turn's
 * darts plus the new one, or `null` when the open turn is not one dart short
 * of `dartsPerVisit`. Only the fields a `VisitPointsRules` reads are set.
 */
export function closingVisitDarts(
  open: TurnFact | null,
  observation: DartObservation,
  dartsPerVisit: number,
): DartFact[] | null {
  if (open?.darts.length !== dartsPerVisit - 1) return null;
  return [
    ...open.darts,
    {
      hitTargetNumber: observation.hitTargetNumber,
      hitZoneKey: observation.hitZoneKey,
      score: boardScore(observation.hitTargetNumber, observation.hitZoneKey),
    } as DartFact,
  ];
}

/** The folded state a visit-race spec reads: an outcome, the active seat and each seat's running total. */
type VisitRaceState = {
  status: string;
  activeParticipantRef: string;
  seats: readonly { participantRef: string; total: number }[];
};

/**
 * `DartGameSpec.isVisitOpen` for a visit-race game: a turn takes darts until
 * it holds `dartsPerVisit`, and only while the game is `IN_PROGRESS`.
 */
export function visitRaceVisitOpen(
  dartsPerVisit: number,
): (turn: TurnFact, state: VisitRaceState) => boolean {
  return (turn, state) =>
    turn.completedAt === null &&
    turn.darts.length < dartsPerVisit &&
    state.status === "IN_PROGRESS";
}

/**
 * `DartGameSpec.wouldComplete` for a visit-race game: only the dart that
 * closes the active seat's open visit can end it, and `finishes` judges the
 * seat's total before the visit against the visit's darts.
 */
export function visitRaceWouldComplete(
  dartsPerVisit: number,
  finishes: (seatTotal: number, visitDarts: readonly DartFact[]) => boolean,
): (
  state: VisitRaceState,
  observation: DartObservation,
  config: unknown,
  open: TurnFact | null,
) => boolean {
  return (state, observation, _config, open) => {
    const darts = closingVisitDarts(open, observation, dartsPerVisit);
    if (state.status !== "IN_PROGRESS" || darts === null) return false;
    const seat = state.seats.find(
      (candidate) => candidate.participantRef === state.activeParticipantRef,
    )!;
    return finishes(seat.total, darts);
  };
}
