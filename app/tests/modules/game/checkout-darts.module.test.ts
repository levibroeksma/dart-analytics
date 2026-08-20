import { describe, expect, it } from "vitest";
import {
  checkoutDartOptions,
  checkoutDartsRejection,
} from "@modules/game/checkout-darts.module";

describe("checkoutDartOptions", () => {
  it("offers every dart count from the route's length up to the visit maximum", () => {
    expect(checkoutDartOptions(41, 3)).toEqual({
      toFinish: [2, 3],
      atDouble: [1, 2],
    });
  });

  it("offers all three counts for a one-dart finish", () => {
    expect(checkoutDartOptions(40, 3)).toEqual({
      toFinish: [1, 2, 3],
      atDouble: [1, 2, 3],
    });
  });

  it("collapses to a single answer when the route needs the whole visit", () => {
    expect(checkoutDartOptions(170, 3)).toEqual({
      toFinish: [3],
      atDouble: [1],
    });
  });

  it("treats a score with no finish route as needing the whole visit", () => {
    expect(checkoutDartOptions(169, 3)).toEqual({
      toFinish: [3],
      atDouble: [1],
    });
  });

  it("honours a visit maximum below three", () => {
    expect(checkoutDartOptions(40, 2)).toEqual({
      toFinish: [1, 2],
      atDouble: [1, 2],
    });
  });
});

describe("checkoutDartsRejection", () => {
  it("accepts counts the route allows", () => {
    expect(checkoutDartsRejection(41, 2, 1, 3)).toBeNull();
  });

  it("accepts an unreported claim", () => {
    expect(checkoutDartsRejection(41, undefined, undefined, 3)).toBeNull();
  });

  it("rejects finishing in fewer darts than the route needs", () => {
    expect(checkoutDartsRejection(41, 1, 1, 3)).toMatch(/at least 2 darts/);
  });

  it("rejects more darts than the visit allows", () => {
    expect(checkoutDartsRejection(40, 3, 1, 2)).toMatch(/at most 2 darts/);
  });

  it("rejects more darts at a double than the visit used", () => {
    expect(checkoutDartsRejection(40, 1, 2, 3)).toMatch(/at a double/);
  });
});
