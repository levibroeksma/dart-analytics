import { describe, expect, it } from "vitest";
import { resolveCheckoutAttempt } from "@modules/game/checkout-bust.module";

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
