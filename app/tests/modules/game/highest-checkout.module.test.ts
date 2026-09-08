import { describe, expect, it } from "vitest";
import { highestCheckout } from "@modules/game/highest-checkout.module";
import type { CheckoutVisitDarts, DartFact } from "@modules/types";

function dart(hitZoneKey: DartFact["hitZoneKey"], score: number): DartFact {
  return {
    sequence: 1,
    intendedTargetNumber: null,
    intendedZoneKey: null,
    hitTargetNumber: null,
    hitZoneKey,
    score,
    locationX: null,
    locationY: null,
  };
}

describe("highestCheckout", () => {
  it("returns null when no visit finishes", () => {
    const visits: CheckoutVisitDarts[] = [
      { startingRemaining: 40, darts: [dart("SINGLE", 20)] },
    ];
    expect(highestCheckout(visits)).toBeNull();
  });

  it("returns the finishing value and a repeat count of 1 for a single finish", () => {
    const visits: CheckoutVisitDarts[] = [
      { startingRemaining: 40, darts: [dart("DOUBLE", 40)] },
    ];
    expect(highestCheckout(visits)).toEqual({ value: 40, timesHit: 1 });
  });

  it("returns the highest finish across visits, ignoring lower ones", () => {
    const visits: CheckoutVisitDarts[] = [
      { startingRemaining: 40, darts: [dart("DOUBLE", 40)] },
      { startingRemaining: 50, darts: [dart("INNER_BULL", 50)] },
    ];
    expect(highestCheckout(visits)).toEqual({ value: 50, timesHit: 1 });
  });

  it("counts repeats of the same highest finish value", () => {
    const visits: CheckoutVisitDarts[] = [
      { startingRemaining: 40, darts: [dart("DOUBLE", 40)] },
      { startingRemaining: 40, darts: [dart("DOUBLE", 40)] },
      { startingRemaining: 32, darts: [dart("DOUBLE", 32)] },
    ];
    expect(highestCheckout(visits)).toEqual({ value: 40, timesHit: 2 });
  });

  it("only counts a dart that lands exactly on the remaining score's double or inner bull", () => {
    const visits: CheckoutVisitDarts[] = [
      { startingRemaining: 40, darts: [dart("OUTER_BULL", 25)] },
      { startingRemaining: 36, darts: [dart("DOUBLE", 32)] },
    ];
    expect(highestCheckout(visits)).toBeNull();
  });

  it("finds a finish that isn't the visit's last dart, valued at the visit's starting remaining", () => {
    const visits: CheckoutVisitDarts[] = [
      {
        startingRemaining: 100,
        darts: [dart("TREBLE", 60), dart("DOUBLE", 40), dart("SINGLE", 5)],
      },
    ];
    expect(highestCheckout(visits)).toEqual({ value: 100, timesHit: 1 });
  });

  it("values a multi-dart finish at the visit's starting remaining, not the last dart's local remaining", () => {
    // 170 checkout: T20 (60), T20 (60), Bullseye (50) -- the classic maximum finish.
    const visits: CheckoutVisitDarts[] = [
      {
        startingRemaining: 170,
        darts: [dart("TREBLE", 60), dart("TREBLE", 60), dart("INNER_BULL", 50)],
      },
    ];
    expect(highestCheckout(visits)).toEqual({ value: 170, timesHit: 1 });
  });
});
