import type {
  OneTwentyOneSnapshot,
  OneTwentyOneV2Snapshot,
  Seated,
  TuodSnapshot,
} from "@lib/types";
import { foldOneTwentyOneState } from "./one-twenty-one.engine.module";
import { foldTuodState } from "./tuod.engine.module";
import { turnsBeforeVisit } from "./turn-log.module";
import type {
  CheckoutVisitDarts,
  EngineFacts,
  StageFact,
  TurnFact,
} from "./types";

type OneTwentyOneLadderConfig =
  Seated<OneTwentyOneSnapshot> | Seated<OneTwentyOneV2Snapshot>;

/**
 * One seat's checkout visits, each carrying the remaining score it opened
 * against -- `startingScore` at the start of a leg, or the running total of
 * that seat's own earlier visits in the same leg subtracted from it, since a
 * leg's remaining score never carries across a leg boundary.
 *
 * Reads `totalScore`, the visit's *counted* score, which the engine zeroes on
 * a bust while the visit keeps its darts' real board scores. Summing the
 * darts instead would move every later dart in the leg onto a remaining the
 * player was never on.
 */
export function fiveOhOneCheckoutVisits(
  seatTurns: readonly TurnFact[],
  startingScore: number,
): CheckoutVisitDarts[] {
  const remainingByStage = new Map<string, number>();
  return seatTurns.map((turn) => {
    const startingRemaining =
      remainingByStage.get(turn.stageClientKey) ?? startingScore;
    remainingByStage.set(
      turn.stageClientKey,
      startingRemaining - turn.totalScore,
    );
    return { startingRemaining, darts: turn.darts };
  });
}

/**
 * One seat's checkout visits, each carrying the target it opened against --
 * folded via `foldTuodState` over every turn strictly before it, mirroring
 * `TuodEngine`'s own (private) `targetBeforeVisit`. `timerExpired` is always
 * `false` here: every visit folded this way is already closed, and a closed
 * visit's own `currentTarget` never depends on the live timer flag.
 */
export function tuodCheckoutVisits(
  seatTurns: readonly TurnFact[],
  facts: EngineFacts,
  config: Seated<TuodSnapshot>,
  participantRef: string,
): CheckoutVisitDarts[] {
  return seatTurns.map((visit) => ({
    startingRemaining: foldTuodState(
      { stages: facts.stages, turns: turnsBeforeVisit(facts.turns, visit) },
      config,
      false,
    ).seats.find((seat) => seat.participantRef === participantRef)!
      .currentTarget,
    darts: visit.darts,
  }));
}

/**
 * One seat's checkout visits, each carrying the remaining score it opened
 * against -- folded via `foldOneTwentyOneState` over every turn strictly
 * before it, mirroring `OneTwentyOneEngine`'s own (private)
 * `seatBeforeVisit`. `timerExpired` is always `false` here, for the same
 * reason it is in `tuodCheckoutVisits`.
 */
export function oneTwentyOneCheckoutVisits(
  seatTurns: readonly TurnFact[],
  stages: readonly StageFact[],
  turns: readonly TurnFact[],
  config: OneTwentyOneLadderConfig,
  participantRef: string,
): CheckoutVisitDarts[] {
  return seatTurns.map((visit) => ({
    startingRemaining: foldOneTwentyOneState(
      { stages: [...stages], turns: turnsBeforeVisit(turns, visit) },
      config,
      false,
    ).seats.find((seat) => seat.participantRef === participantRef)!
      .remainingInAttempt,
    darts: visit.darts,
  }));
}
