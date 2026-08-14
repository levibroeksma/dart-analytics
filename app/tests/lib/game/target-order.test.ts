import { describe, expect, it, vi } from "vitest";
import {
  ascendingTargetOrder,
  descendingTargetOrder,
  randomTargetOrder,
  targetOrderFor,
} from "@lib/game/target-order";

const ASCENDING = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
];
const DESCENDING = [
  25, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
];

describe("ascendingTargetOrder", () => {
  it("is 1..20 then BULL (25)", () => {
    expect(ascendingTargetOrder()).toEqual(ASCENDING);
  });
});

describe("descendingTargetOrder", () => {
  it("leads with BULL (25), then 20 down to 1", () => {
    expect(descendingTargetOrder()).toEqual(DESCENDING);
  });
});

describe("randomTargetOrder", () => {
  it("is a permutation of the same 21 values every time", () => {
    for (let i = 0; i < 10; i++) {
      const order = randomTargetOrder();
      expect(order).toHaveLength(21);
      expect(new Set(order)).toEqual(new Set(ASCENDING));
    }
  });

  it("does not always return the ascending order", () => {
    const results = Array.from({ length: 20 }, () => randomTargetOrder());
    expect(
      results.some((order) => order.join(",") !== ASCENDING.join(",")),
    ).toBe(true);
  });
});

describe("targetOrderFor", () => {
  it("dispatches LOW_TO_HIGH to ascendingTargetOrder", () => {
    expect(targetOrderFor("LOW_TO_HIGH")).toEqual(ASCENDING);
  });

  it("dispatches HIGH_TO_LOW to descendingTargetOrder", () => {
    expect(targetOrderFor("HIGH_TO_LOW")).toEqual(DESCENDING);
  });

  it("dispatches RANDOM to a shuffled permutation", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      const order = targetOrderFor("RANDOM");
      expect(new Set(order)).toEqual(new Set(ASCENDING));
    } finally {
      spy.mockRestore();
    }
  });
});
