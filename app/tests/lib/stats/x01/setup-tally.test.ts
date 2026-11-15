import { describe, expect, it } from "vitest";
import { tallySetup } from "@lib/stats/x01/setup-tally";

describe("tallySetup", () => {
  it("sums resolutions per basis and kind and skips VISITS", () => {
    expect(
      tallySetup({
        "ROUTE|TREBLE|SOLE": { attempts: 3, hits: 1 },
        "ROUTE|TREBLE|NEAREST": { attempts: 2, hits: 2 },
        VISITS: { visits: 5, goodLeaves: 4 },
      }),
    ).toEqual([
      { basis: "ROUTE", kind: "TREBLE", attempts: 5, hits: 3, rate: null },
    ]);
  });
});
