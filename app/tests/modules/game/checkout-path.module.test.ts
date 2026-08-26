import { describe, expect, it } from "vitest";
import {
  checkoutPathFor,
  isCheckoutReachable,
} from "@modules/game/checkout-path.module";

describe("checkoutPathFor", () => {
  it("returns the highest possible finish for 170", () => {
    expect(checkoutPathFor(170)).toEqual(["T20", "T20", "BULL"]);
  });

  it("returns null for every bogey number", () => {
    for (const bogey of [169, 168, 166, 165, 163, 162, 159]) {
      expect(checkoutPathFor(bogey)).toBeNull();
    }
  });

  it("returns a two-dart finish for 160", () => {
    expect(checkoutPathFor(160)).toEqual(["T20", "T20", "D20"]);
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

// Parses a single dart-route label into its point value. Labels: a bare
// number is a single ("20" -> 20), "T"-prefixed is a treble ("T20" -> 60),
// "D"-prefixed is a double ("D20" -> 40), "BULL" is the inner bull (50).
function dartValue(label: string): number {
  if (label === "BULL") return 50;
  if (label.startsWith("T")) return 3 * Number(label.slice(1));
  if (label.startsWith("D")) return 2 * Number(label.slice(1));
  return Number(label);
}

const BOGEY_NUMBERS = [169, 168, 166, 165, 163, 162, 159, 1];

describe("checkoutPathFor — table-wide invariants", () => {
  for (let score = 2; score <= 170; score++) {
    if (BOGEY_NUMBERS.includes(score)) continue;

    const route = checkoutPathFor(score);

    it(`has a route for ${score}`, () => {
      expect(route).not.toBeNull();
    });

    it(`sums to exactly ${score}`, () => {
      const sum = (route ?? []).reduce(
        (total, dart) => total + dartValue(dart),
        0,
      );
      expect(sum).toBe(score);
    });

    it(`finishes ${score} on a double or BULL`, () => {
      const lastDart = (route ?? [])[(route ?? []).length - 1];
      expect(lastDart === "BULL" || lastDart?.startsWith("D")).toBe(true);
    });

    it(`uses at most 3 darts for ${score}`, () => {
      expect((route ?? []).length).toBeLessThanOrEqual(3);
    });
  }

  for (const bogey of BOGEY_NUMBERS) {
    it(`returns null for bogey/unreachable number ${bogey}`, () => {
      expect(checkoutPathFor(bogey)).toBeNull();
    });
  }
});

describe("isCheckoutReachable", () => {
  it("is true when the route's minimum darts exactly matches darts available", () => {
    expect(isCheckoutReachable(121, 3)).toBe(true); // T20 T11 D14 = 3 darts
  });

  it("is true with slack darts to spare", () => {
    expect(isCheckoutReachable(25, 3)).toBe(true); // 9 D8 = 2 darts, 3 available
  });

  it("is false when fewer darts remain than the route needs", () => {
    expect(isCheckoutReachable(25, 1)).toBe(false); // needs 2, only 1 left
  });

  it("is true for a single-dart double with exactly 1 dart left", () => {
    expect(isCheckoutReachable(40, 1)).toBe(true); // D20
  });

  it("is false for every bogey number regardless of darts available", () => {
    for (const bogey of [169, 168, 166, 165, 163, 162, 159, 1]) {
      expect(isCheckoutReachable(bogey, 3)).toBe(false);
    }
  });

  it("is false when no darts remain", () => {
    expect(isCheckoutReachable(40, 0)).toBe(false);
  });
});
