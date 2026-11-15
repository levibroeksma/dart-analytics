import { describe, expect, it } from "vitest";
import { tallyPreference } from "@lib/stats/x01/preference-tally";

describe("tallyPreference", () => {
  it("folds state and resolution rows per double and skips ambiguous", () => {
    const rows = tallyPreference({
      "DOUBLE:16|STATE": { left: 4, splitAway: 1 },
      "DOUBLE:16|SOLE": { attempts: 3, hits: 1 },
      AMBIGUOUS: { darts: 2 },
    });
    expect(rows).toEqual([
      {
        finish: "DOUBLE:16",
        label: "D16",
        left: 4,
        splitAway: 1,
        splitRate: null,
        attempts: 3,
        hits: 1,
      },
    ]);
  });
});
