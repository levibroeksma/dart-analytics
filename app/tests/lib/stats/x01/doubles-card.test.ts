import { describe, expect, it } from "vitest";
import { doublesCard } from "@lib/stats/x01/doubles-card";

const hit = (darts: number) => ({ darts });

describe("doublesCard", () => {
  it("headlines hits over darts and names best and worst among rated doubles", () => {
    const card = doublesCard({
      "DOUBLE:16|SOLE|HIT": hit(10),
      "DOUBLE:16|SOLE|MISS|INSIDE|0": hit(10),
      "DOUBLE:3|SOLE|HIT": hit(3),
      "DOUBLE:3|SOLE|MISS|OUTSIDE|3": hit(9),
      "DOUBLE:8|SOLE|HIT": hit(5),
    });
    expect(card.headline).toBeCloseTo(18 / 37);
    expect(card.caption).toBe("Best D16 · worst D3");
    expect(card.rows.map((r) => r.label)).toEqual(["D3", "D8", "D16"]);
    expect(card.rows[1].rate).toBeNull();
  });

  it("a rate tie goes to the double with more darts", () => {
    const card = doublesCard({
      "DOUBLE:1|SOLE|HIT": hit(5),
      "DOUBLE:1|SOLE|MISS|INSIDE|0": hit(5),
      "DOUBLE:2|SOLE|HIT": hit(10),
      "DOUBLE:2|SOLE|MISS|INSIDE|0": hit(10),
      "DOUBLE:3|SOLE|HIT": hit(1),
      "DOUBLE:3|SOLE|MISS|INSIDE|0": hit(19),
    });
    expect(card.caption).toBe("Best D2 · worst D3");
  });

  it("splits misses by band and sector and sorts the bull last", () => {
    const card = doublesCard({
      "INNER_BULL:25|SOLE|MISS|WITHIN|5": hit(2),
      "DOUBLE:20|SOLE|MISS|OUTSIDE|3": hit(4),
      "DOUBLE:20|NEAREST|MISS|OUTSIDE|3": hit(1),
    });
    expect(card.rows.map((r) => r.label)).toEqual(["D20", "Bull"]);
    expect(card.rows[0]).toMatchObject({ outside: 5, inside: 0 });
    expect(card.rows[0].sectors[3]).toBe(5);
    expect(card.rows[1]).toMatchObject({ within: 2 });
  });

  it("an AMBIGUOUS-only bucket has no headline and keeps the count", () => {
    const card = doublesCard({ AMBIGUOUS: { darts: 6 } });
    expect(card.headline).toBeNull();
    expect(card.caption).toBeNull();
    expect(card.rows).toEqual([]);
    expect(card.ambiguous).toBe(6);
  });
});
