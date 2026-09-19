import { describe, expect, it } from "vitest";
import {
  checkoutPathFor,
  checkoutPathWithin,
} from "@modules/game/checkout-path.module";
import { isCheckoutReachable } from "@modules/game/checkout-reachability.module";

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

  it("returns the conventional two-dart finish for 50, not the shorter BULL", () => {
    expect(checkoutPathFor(50)).toEqual(["10", "D20"]);
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

describe("checkoutPathWithin", () => {
  it("returns the curated route when it fits the darts left", () => {
    expect(checkoutPathWithin(121, 3)).toEqual(["T20", "T11", "D14"]);
    expect(checkoutPathWithin(100, 2)).toEqual(["T20", "D20"]);
    expect(checkoutPathWithin(40, 1)).toEqual(["D20"]);
  });

  it("substitutes a shorter true route when the curated one is too long (#291)", () => {
    expect(checkoutPathWithin(50, 1)).toEqual(["BULL"]);
    expect(checkoutPathWithin(101, 2)).toEqual(["T17", "BULL"]);
    expect(checkoutPathWithin(104, 2)).toEqual(["T18", "BULL"]);
    expect(checkoutPathWithin(107, 2)).toEqual(["T19", "BULL"]);
    expect(checkoutPathWithin(110, 2)).toEqual(["T20", "BULL"]);
  });

  it("returns null when no route of any kind fits the darts left", () => {
    expect(checkoutPathWithin(121, 2)).toBeNull();
    expect(checkoutPathWithin(50, 0)).toBeNull();
    expect(checkoutPathWithin(3, 1)).toBeNull();
  });

  it("returns null for bogey numbers, 1, 0 and out-of-range scores", () => {
    for (const bogey of BOGEY_NUMBERS) {
      expect(checkoutPathWithin(bogey, 3)).toBeNull();
    }
    expect(checkoutPathWithin(0, 3)).toBeNull();
    expect(checkoutPathWithin(171, 3)).toBeNull();
    expect(checkoutPathWithin(40.5, 3)).toBeNull();
    expect(checkoutPathWithin(-5, 3)).toBeNull();
  });
});

describe("checkoutPathWithin — table-wide invariants", () => {
  for (let score = 2; score <= 170; score++) {
    if (BOGEY_NUMBERS.includes(score)) continue;

    for (const dartsLeft of [1, 2, 3]) {
      const route = checkoutPathWithin(score, dartsLeft);
      if (route === null) continue;

      it(`route for ${score} with ${dartsLeft} dart(s) fits, sums and doubles out`, () => {
        expect(route.length).toBeLessThanOrEqual(dartsLeft);
        expect(route.reduce((total, dart) => total + dartValue(dart), 0)).toBe(
          score,
        );
        const lastDart = route[route.length - 1];
        expect(lastDart === "BULL" || lastDart.startsWith("D")).toBe(true);
      });
    }

    it(`offers a route for ${score} whenever one is truly reachable`, () => {
      for (const dartsLeft of [1, 2, 3]) {
        expect(checkoutPathWithin(score, dartsLeft) !== null).toBe(
          isCheckoutReachable(score, dartsLeft),
        );
      }
    });
  }
});
