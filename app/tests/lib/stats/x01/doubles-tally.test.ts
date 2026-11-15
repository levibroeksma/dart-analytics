import { describe, expect, it } from "vitest";
import { tallyDoubles } from "@lib/stats/x01/doubles-tally";

describe("tallyDoubles", () => {
  it("counts hits, misses by band and sector, bull last", () => {
    const rows = tallyDoubles({
      "INNER_BULL:25|SOLE|HIT": { darts: 1 },
      "DOUBLE:20|SOLE|MISS|OUTSIDE|3": { darts: 4 },
      "DOUBLE:20|NEAREST|HIT": { darts: 2 },
      AMBIGUOUS: { darts: 9 },
    });
    expect(rows.map((r) => r.label)).toEqual(["D20", "Bull"]);
    expect(rows[0]).toMatchObject({ darts: 6, hits: 2, outside: 4 });
    expect(rows[0].sectors[3]).toBe(4);
  });
});
