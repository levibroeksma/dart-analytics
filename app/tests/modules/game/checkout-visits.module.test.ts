import { describe, expect, it } from "vitest";
import { fiveOhOneCheckoutVisits } from "@modules/game/checkout-visits.module";
import type { DartFact, TurnFact } from "@modules/types";

function dart(
  sequence: number,
  hitTargetNumber: number | null,
  hitZoneKey: DartFact["hitZoneKey"],
  score: number,
): DartFact {
  return {
    sequence,
    intendedTargetNumber: null,
    intendedZoneKey: null,
    hitTargetNumber,
    hitZoneKey,
    score,
    locationX: null,
    locationY: null,
  };
}

function turn(
  sequence: number,
  totalScore: number,
  darts: DartFact[],
): TurnFact {
  return {
    clientKey: `turn-${sequence}`,
    stageClientKey: "leg-1",
    participantRef: "seat-1",
    sequence,
    completedAt: "2026-09-19T10:00:00.000Z",
    totalScore,
    darts,
  };
}

describe("fiveOhOneCheckoutVisits", () => {
  it("opens the first visit of a leg on the session's starting score", () => {
    const visits = fiveOhOneCheckoutVisits(
      [turn(1, 60, [dart(1, 20, "TREBLE", 60)])],
      501,
    );
    expect(visits.map((visit) => visit.startingRemaining)).toEqual([501]);
  });

  it("subtracts each visit's counted total from the next visit's remaining", () => {
    const visits = fiveOhOneCheckoutVisits(
      [
        turn(1, 60, [dart(1, 20, "TREBLE", 60)]),
        turn(2, 100, [dart(1, 20, "TREBLE", 60), dart(2, 20, "DOUBLE", 40)]),
      ],
      501,
    );
    expect(visits.map((visit) => visit.startingRemaining)).toEqual([501, 441]);
  });

  it("ignores a busted visit's thrown darts, which the engine zeroes out of the counted total", () => {
    const busted = turn(2, 0, [dart(1, 20, "TREBLE", 60)]);
    const visits = fiveOhOneCheckoutVisits(
      [turn(1, 60, [dart(1, 20, "TREBLE", 60)]), busted, turn(3, 0, [])],
      501,
    );
    expect(visits.map((visit) => visit.startingRemaining)).toEqual([
      501, 441, 441,
    ]);
  });

  it("restarts each leg at the starting score", () => {
    const legTwo: TurnFact = {
      ...turn(2, 60, [dart(1, 20, "TREBLE", 60)]),
      stageClientKey: "leg-2",
    };
    const visits = fiveOhOneCheckoutVisits(
      [turn(1, 60, [dart(1, 20, "TREBLE", 60)]), legTwo],
      501,
    );
    expect(visits.map((visit) => visit.startingRemaining)).toEqual([501, 501]);
  });
});
