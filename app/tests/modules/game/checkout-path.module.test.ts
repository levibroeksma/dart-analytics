import { describe, expect, it } from "vitest";
import { checkoutPathFor } from "@modules/game/checkout-path.module";

describe("checkoutPathFor", () => {
  it("returns the highest possible finish for 170", () => {
    expect(checkoutPathFor(170)).toEqual(["20", "T20", "BULL"]);
  });

  it("returns null for every bogey number", () => {
    for (const bogey of [169, 168, 166, 165, 163, 162, 159]) {
      expect(checkoutPathFor(bogey)).toBeNull();
    }
  });

  it("returns a two-dart finish for 160", () => {
    expect(checkoutPathFor(160)).toEqual(["20", "T20", "D20"]);
  });

  it("returns the classic two-dart 100 finish", () => {
    expect(checkoutPathFor(100)).toEqual(["T20", "D20"]);
  });

  it("returns a single-dart double for 40", () => {
    expect(checkoutPathFor(40)).toEqual(["D20"]);
  });

  it("returns a single-dart double for the lowest finish, 2", () => {
    expect(checkoutPathFor(2)).toEqual(["D1"]);
  });

  it("returns null for 1 — no double can ever land on it", () => {
    expect(checkoutPathFor(1)).toBeNull();
  });

  it("returns null for 0", () => {
    expect(checkoutPathFor(0)).toBeNull();
  });

  it("returns null above the maximum checkout of 170", () => {
    expect(checkoutPathFor(171)).toBeNull();
  });

  it("returns null for a non-integer score", () => {
    expect(checkoutPathFor(40.5)).toBeNull();
  });

  it("returns null for a negative score", () => {
    expect(checkoutPathFor(-5)).toBeNull();
  });
});
