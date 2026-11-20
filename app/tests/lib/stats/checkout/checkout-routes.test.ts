import { describe, expect, it } from "vitest";
import { pathRemainings, routesFor } from "@lib/stats/checkout/checkout-routes";

const metrics = {
  "40": {
    "S20 D10": { visits: 2, finished: 1 },
    D20: { visits: 5, finished: 3 },
  },
  "170": { "T20 T20 BULL": { visits: 1, finished: 0 } },
};

describe("checkout routes", () => {
  it("lists remainings highest first", () => {
    expect(pathRemainings(metrics)).toEqual([170, 40]);
    expect(pathRemainings({})).toEqual([]);
  });

  it("lists routes most used first with a finish rate", () => {
    expect(routesFor(metrics, 40)).toEqual([
      { route: "D20", visits: 5, finished: 3, finishRate: 0.6 },
      { route: "S20 D10", visits: 2, finished: 1, finishRate: 0.5 },
    ]);
    expect(routesFor(metrics, 99)).toEqual([]);
  });
});
