import type {
  DartCount,
  DartObservation,
  OneTwentyOneInput,
  OneTwentyOneState,
  OneTwentyOneVisitInput,
  TuodAttemptInput,
  TuodInput,
  TuodState,
} from "@modules/types";
import { zoneCentroid } from "@lib/game/board/board-geometry.module";
import { randomObservation, type OracleEngine } from "./engine-oracle";

const BASE = { locationX: null, locationY: null };

/** The dart that finishes `remaining`, or the set-up shot towards a double. */
function finishingShot(remaining: number): DartObservation {
  if (remaining === 50)
    return { ...BASE, hitTargetNumber: 25, hitZoneKey: "INNER_BULL" };
  if (remaining <= 40 && remaining % 2 === 0)
    return { ...BASE, hitTargetNumber: remaining / 2, hitZoneKey: "DOUBLE" };
  if (remaining > 60)
    return { ...BASE, hitTargetNumber: 20, hitZoneKey: "TREBLE" };
  const single = remaining > 40 ? remaining - 40 : 1;
  return { ...BASE, hitTargetNumber: single, hitZoneKey: "OUTER_SINGLE" };
}

/**
 * With probability `rate`, throws towards a double-out of the engine's
 * current `remaining`; otherwise a random board hit — so checkouts, busts
 * and spent visits all occur.
 */
export function towardCheckout(rate: number) {
  return (rand: () => number, engine: OracleEngine): DartObservation => {
    const remaining = (engine.state() as { remaining?: number }).remaining ?? 0;
    if (rand() >= rate || remaining <= 1) return randomObservation(rand);
    return finishingShot(remaining);
  };
}

function randomAttempt(rand: () => number): TuodAttemptInput {
  const count = (1 + Math.floor(rand() * 3)) as 1 | 2 | 3;
  const atDouble = (1 + Math.floor(rand() * 3)) as 1 | 2 | 3;
  return {
    checkedOut: rand() < 0.5,
    dartsUsed: count,
    dartsAtDouble: atDouble,
    finishedOnDouble: rand() < 0.7,
  };
}

const OUTER_BULL_POINT = { x: 10, y: 0 };

/**
 * A coordinate-captured dart: the observation placed at its zone's centre so
 * the engine's own classification resolves it. A miss stays unlocated, the
 * unseen-dart path.
 */
export function located(observation: DartObservation): DartObservation {
  const { hitTargetNumber, hitZoneKey } = observation;
  if (hitZoneKey === "MISS") return observation;
  const point =
    hitZoneKey === "OUTER_BULL"
      ? OUTER_BULL_POINT
      : zoneCentroid(hitTargetNumber, hitZoneKey);
  return point
    ? { ...observation, locationX: point.x, locationY: point.y }
    : observation;
}

/**
 * Mixes the two TUOD input shapes in one log: with probability `visitRate` a
 * keypad total (valid and invalid alike, so every refusal fires), otherwise a
 * located board dart — towards the active seat's live remainder with probability
 * `towardRate`, else random.
 */
export function tuodInputs(visitRate: number, towardRate: number) {
  return (rand: () => number, engine: OracleEngine<TuodInput>): TuodInput => {
    if (rand() < visitRate) return randomAttempt(rand);
    const state = engine.state() as TuodState;
    const seat = state.seats.find(
      (candidate) => candidate.participantRef === state.activeParticipantRef,
    )!;
    if (rand() >= towardRate || seat.remainingInAttempt <= 1)
      return located(randomObservation(rand));
    return located(finishingShot(seat.remainingInAttempt));
  };
}

function randomVisit(
  rand: () => number,
  remaining: number,
  checkoutRate: number,
): OneTwentyOneVisitInput {
  const count = (1 + Math.floor(rand() * 3)) as DartCount;
  const atDouble = (1 + Math.floor(rand() * 3)) as DartCount;
  if (rand() < checkoutRate)
    return {
      scoreAttempted: remaining,
      finishedOnDouble: true,
      dartsUsed: count,
      dartsAtDouble: atDouble,
    };
  return {
    scoreAttempted: Math.floor(rand() * 185),
    finishedOnDouble: rand() < 0.5,
    dartsUsed: count,
    dartsAtDouble: atDouble,
  };
}

/**
 * Mixes the two 121 input shapes in one log, as the play page can: with
 * probability `visitRate`, when no board visit is open, a keypad total — an exact check-out of the active seat's live remainder with
 * probability `checkoutRate`, else any score in `0..184` (out-of-range ones
 * fire the guard) — otherwise a located board dart, towards the remainder with
 * probability `towardRate`, else random.
 */
export function oneTwentyOneInputs(
  visitRate: number,
  towardRate: number,
  checkoutRate: number,
) {
  return (
    rand: () => number,
    engine: OracleEngine<OneTwentyOneInput>,
  ): OneTwentyOneInput => {
    const state = engine.state() as OneTwentyOneState;
    const seat = state.seats.find(
      (candidate) => candidate.participantRef === state.activeParticipantRef,
    )!;
    const boardVisitOpen = engine.facts().turns.at(-1)?.completedAt === null;
    if (rand() < visitRate && !boardVisitOpen)
      return randomVisit(rand, seat.remainingInAttempt, checkoutRate);
    if (rand() >= towardRate || seat.remainingInAttempt <= 1)
      return located(randomObservation(rand));
    return located(finishingShot(seat.remainingInAttempt));
  };
}
