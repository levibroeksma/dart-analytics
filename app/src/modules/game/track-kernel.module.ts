import type { SeatFact } from "@lib/types";
import type { TrackRules } from "./interfaces";
import { foldSeatStates } from "./seat-state.module";
import type {
  DartObservation,
  JudgedDart,
  SeatState,
  TrackSeat,
  TurnFact,
} from "./types";

/** A Track seat before its first dart: first target, zero counters, `score` (default 0) and `ext` as given. */
export function initialTrackSeat<TExt>(
  seat: SeatState,
  ext: TExt,
  score = 0,
): TrackSeat<TExt> {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    targetIndex: 0,
    score,
    dartsThisVisit: 0,
    hitsThisVisit: 0,
    status: "IN_PROGRESS",
    ext,
  };
}

/**
 * The Track kernel's one reducer (Pattern 18 §Rule-kernel families): judge
 * the dart against the seat's target, add its points, run `onDart`, and when
 * `visitOpen` turns false run `onVisitClose` and reset the visit counters.
 * Every rule a ruleset makes lives in `rules`; this function branches only
 * on the visit boundary.
 * @throws `rules.doneMessage` when the seat is not `IN_PROGRESS`.
 */
export function applyTrackDart<TExt>(
  seat: TrackSeat<TExt>,
  observation: DartObservation,
  rules: TrackRules<TExt>,
): TrackSeat<TExt> {
  if (seat.status !== "IN_PROGRESS") throw new Error(rules.doneMessage);
  const target = rules.target(seat);
  const hit = rules.hit(target, observation);
  const dart: JudgedDart = {
    observation,
    target,
    hit,
    points: rules.points(target, observation, hit),
  };
  const judged: TrackSeat<TExt> = {
    ...seat,
    score: seat.score + dart.points,
    dartsThisVisit: seat.dartsThisVisit + 1,
    hitsThisVisit: seat.hitsThisVisit + (hit ? 1 : 0),
  };
  const afterDart = rules.onDart ? rules.onDart(judged, dart) : judged;
  if (rules.visitOpen(afterDart)) return afterDart;
  const closed = rules.onVisitClose ? rules.onVisitClose(afterDart) : afterDart;
  return { ...closed, dartsThisVisit: 0, hitsThisVisit: 0 };
}

/** Folds every seat over its own darts through `applyTrackDart`; nothing is stored. */
export function foldTrackSeats<TExt>(
  turns: readonly TurnFact[],
  seats: readonly SeatFact[],
  initialExt: () => TExt,
  rules: TrackRules<TExt>,
): TrackSeat<TExt>[] {
  return foldSeatStates(
    turns,
    seats,
    (seat) => initialTrackSeat(seat, initialExt(), rules.startScore),
    (state, observation) => applyTrackDart(state, observation, rules),
  );
}

/**
 * Folds one seat over every dart in `turns`, in write order, whoever threw
 * it — the solo exercise's fold, since its facts log no seats.
 */
export function foldTrackDarts<TExt>(
  turns: readonly TurnFact[],
  initial: TrackSeat<TExt>,
  rules: TrackRules<TExt>,
): TrackSeat<TExt> {
  return turns
    .flatMap((turn) => turn.darts)
    .reduce((seat, dart) => applyTrackDart(seat, dart, rules), initial);
}
