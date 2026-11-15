import { describe, expect, it } from "vitest";
import { setupCard } from "@lib/stats/x01/setup-card";

const ROWS = {
  "ROUTE|TREBLE|SOLE": { attempts: 30, hits: 15 },
  "SETUP|DOUBLE|SOLE": { attempts: 10, hits: 2 },
  VISITS: { visits: 20, goodLeaves: 15 },
};

describe("setupCard", () => {
  it("headlines hits over attempts and the good-leave share", () => {
    const card = setupCard(ROWS);
    expect(card.headline).toBeCloseTo(17 / 40);
    expect(card.goodLeave).toBe(0.75);
    expect(card.groups.map((g) => [g.basis, g.kind, g.rate])).toEqual([
      ["ROUTE", "TREBLE", 0.5],
      ["SETUP", "DOUBLE", 0.2],
    ]);
  });

  it("good leave is null without a VISITS row", () => {
    expect(
      setupCard({ "ROUTE|TREBLE|SOLE": ROWS["ROUTE|TREBLE|SOLE"] }).goodLeave,
    ).toBeNull();
  });

  it("a group under the row floor has no rate", () => {
    const card = setupCard({ "SPLIT|DOUBLE|SOLE": { attempts: 4, hits: 2 } });
    expect(card.groups[0]).toMatchObject({ attempts: 4, rate: null });
  });

  it("an AMBIGUOUS-only bucket has no headline and keeps the count", () => {
    const card = setupCard({ AMBIGUOUS: { darts: 8 } });
    expect(card.headline).toBeNull();
    expect(card.goodLeave).toBeNull();
    expect(card.ambiguous).toBe(8);
  });
});
