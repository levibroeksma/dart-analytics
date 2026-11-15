import { describe, expect, it } from "vitest";
import { trebleCard } from "@lib/stats/x01/treble-card";

const ROWS = {
  "TREBLE:20|SOLE": {
    darts: 30,
    trebles: 6,
    singles: 12,
    neighbourLeft: 4,
    neighbourRight: 3,
    other: 5,
  },
  "TREBLE:20|NEAREST": {
    darts: 10,
    trebles: 2,
    singles: 4,
    neighbourLeft: 1,
    neighbourRight: 1,
    other: 2,
  },
  AMBIGUOUS: { darts: 3 },
};

describe("trebleCard", () => {
  it("pools resolutions per aim and headlines the T20 treble share", () => {
    const card = trebleCard(ROWS);
    expect(card.darts).toBe(40);
    expect(card.headline).toBe(0.2);
    expect(card.ambiguous).toBe(3);
    expect(card.rows[0]).toMatchObject({
      aim: "TREBLE:20",
      single: 0.4,
      left: 0.125,
      right: 0.1,
      other: 0.175,
    });
  });

  it("headline is null under the card sample floor", () => {
    const card = trebleCard({
      "TREBLE:20|SOLE": { ...ROWS["TREBLE:20|SOLE"], darts: 12 },
    });
    expect(card.headline).toBeNull();
    expect(card.rows[0].darts).toBe(12);
  });

  it("an AMBIGUOUS-only bucket has no headline and keeps the count", () => {
    const card = trebleCard({ AMBIGUOUS: { darts: 7 } });
    expect(card.headline).toBeNull();
    expect(card.ambiguous).toBe(7);
    expect(card.rows.every((r) => r.darts === 0 && r.treble === null)).toBe(
      true,
    );
  });

  it("a row under the row floor has null rates but keeps its count", () => {
    const card = trebleCard({
      ...ROWS,
      "TREBLE:18|SOLE": {
        darts: 4,
        trebles: 1,
        singles: 1,
        neighbourLeft: 1,
        neighbourRight: 1,
        other: 0,
      },
    });
    expect(card.rows[2]).toMatchObject({
      darts: 4,
      treble: null,
      single: null,
      left: null,
      right: null,
      other: null,
    });
  });

  it("a row at exactly the row floor shows its rates", () => {
    const card = trebleCard({
      "TREBLE:19|SOLE": {
        darts: 10,
        trebles: 5,
        singles: 3,
        neighbourLeft: 1,
        neighbourRight: 1,
        other: 0,
      },
    });
    expect(card.rows[1]).toMatchObject({ darts: 10, treble: 0.5, other: 0 });
  });

  it("lists the three aims in T20, T19, T18 order", () => {
    expect(trebleCard({}).rows.map((r) => r.aim)).toEqual([
      "TREBLE:20",
      "TREBLE:19",
      "TREBLE:18",
    ]);
  });
});
