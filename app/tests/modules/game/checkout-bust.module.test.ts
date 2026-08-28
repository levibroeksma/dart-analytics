import { describe, expect, it } from "vitest";
import {
  checkoutAttemptCount,
  resolveCheckoutAttempt,
} from "@modules/game/checkout-bust.module";
import type { TurnFact } from "@modules/types";

describe("resolveCheckoutAttempt", () => {
  it("scores an ordinary in-range visit with darts left", () => {
    expect(resolveCheckoutAttempt(100, 60, false)).toEqual({
      remainingAfter: 40,
      checkedOut: false,
      busted: false,
    });
  });

  it("checks out when the remainder reaches exactly 0 on a double", () => {
    expect(resolveCheckoutAttempt(40, 40, true)).toEqual({
      remainingAfter: 0,
      checkedOut: true,
      busted: false,
    });
  });

  it("busts on an overshoot", () => {
    expect(resolveCheckoutAttempt(40, 41, false)).toEqual({
      remainingAfter: -1,
      checkedOut: false,
      busted: true,
    });
  });

  it("busts on leaving exactly 1, which cannot be finished on a double", () => {
    expect(resolveCheckoutAttempt(41, 40, false)).toEqual({
      remainingAfter: 1,
      checkedOut: false,
      busted: true,
    });
  });

  it("busts on reaching exactly 0 without a double", () => {
    expect(resolveCheckoutAttempt(40, 40, false)).toEqual({
      remainingAfter: 0,
      checkedOut: false,
      busted: true,
    });
  });

  it("does not bust on reaching exactly 2, since D1 can finish it", () => {
    expect(resolveCheckoutAttempt(42, 40, false)).toEqual({
      remainingAfter: 2,
      checkedOut: false,
      busted: false,
    });
  });
});

function turn(totalScore: number, dartScores: number[]): TurnFact {
  return {
    clientKey: "t1",
    stageClientKey: "leg-1",
    participantRef: "participant-1",
    sequence: 1,
    completedAt: "2026-08-28T00:00:00.000Z",
    totalScore,
    darts: dartScores.map((score, i) => ({
      sequence: i + 1,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: null,
      hitZoneKey: score > 0 ? "TREBLE" : "MISS",
      score,
      locationX: null,
      locationY: null,
    })),
  };
}

describe("checkoutAttemptCount", () => {
  it("returns 0 for an empty log", () => {
    expect(checkoutAttemptCount([])).toBe(0);
  });

  it("counts a busted visit whose darts summed to more than zero", () => {
    const turns = [turn(0, [60, 40, 5])];
    expect(checkoutAttemptCount(turns)).toBe(1);
  });

  it("does not count a genuine zero-score visit (darts thrown, none scored)", () => {
    const turns = [turn(0, [0, 0, 0])];
    expect(checkoutAttemptCount(turns)).toBe(0);
  });

  it("does not count a visit that scored normally (not a bust)", () => {
    const turns = [turn(60, [20, 20, 20])];
    expect(checkoutAttemptCount(turns)).toBe(0);
  });

  it("does not count an open (uncompleted) visit", () => {
    const open: TurnFact = { ...turn(0, [60]), completedAt: null };
    expect(checkoutAttemptCount([open])).toBe(0);
  });

  it("sums busted checkout attempts across several visits", () => {
    const turns = [turn(0, [60]), turn(45, [45]), turn(0, [80, 20])];
    expect(checkoutAttemptCount(turns)).toBe(2);
  });
});
