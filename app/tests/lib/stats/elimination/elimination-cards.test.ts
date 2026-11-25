import { describe, expect, it } from "vitest";
import {
  bedRows,
  eliminationCard,
  prisonerResultRows,
} from "@lib/stats/elimination/elimination-cards";
import { emptyEliminationMetrics } from "@modules/stats/sections/elimination.module";

describe("bedRows", () => {
  it("lists Single, Double, Treble and Bull with visits and a floored rate", () => {
    const m = emptyEliminationMetrics();
    m.followTheLeader.byBed.DOUBLE = { visits: 9, matched: 3 };
    m.followTheLeader.byBed.TREBLE = { visits: 10, matched: 4 };
    const rows = bedRows(m);
    expect(rows.map((r) => r.label)).toEqual([
      "Single",
      "Double",
      "Treble",
      "Bull",
    ]);
    expect(rows[1]).toEqual({ label: "Double", count: 9, cells: ["—"] });
    expect(rows[2]).toEqual({ label: "Treble", count: 10, cells: ["40.0%"] });
  });
});

describe("prisonerResultRows", () => {
  it("gives each result's share of darts in order, summing to 100%", () => {
    const m = emptyEliminationMetrics();
    m.darts = 4;
    m.prisoner = {
      advance: 1,
      advanceAndCapture: 1,
      capture: 1,
      prison: 1,
      miss: 0,
      reached: 3,
    };
    const rows = prisonerResultRows(m);
    expect(rows.map((r) => [r.label, r.count, r.cells[0]])).toEqual([
      ["Advance", 1, "25.0%"],
      ["Advance and capture", 1, "25.0%"],
      ["Capture", 1, "25.0%"],
      ["Prison", 1, "25.0%"],
      ["Miss", 0, "0.0%"],
    ]);
  });

  it("shows no share with no darts", () => {
    const rows = prisonerResultRows(emptyEliminationMetrics());
    expect(rows.every((r) => r.cells[0] === "—")).toBe(true);
  });
});

describe("eliminationCard", () => {
  it("gives Killer no rows and no headers", () => {
    const card = eliminationCard("KILLER", emptyEliminationMetrics(), null);
    expect(card.rows).toEqual([]);
    expect(card.rowHeaders).toBeNull();
    expect(card.rowTitle).toBeNull();
    expect(card.tiles).toHaveLength(4);
  });

  it("gives Follow the Leader its bed rows and Prisoner its result rows", () => {
    const ftl = eliminationCard(
      "FOLLOW_THE_LEADER",
      emptyEliminationMetrics(),
      null,
    );
    expect(ftl.rowTitle).toBe("Match rate by bed");
    expect(ftl.rowHeaders).toEqual(["Visits", "Match rate"]);
    expect(ftl.rows).toHaveLength(4);
    const prisoner = eliminationCard(
      "PRISONER",
      emptyEliminationMetrics(),
      null,
    );
    expect(prisoner.rowTitle).toBe("Dart results");
    expect(prisoner.rowHeaders).toEqual(["Darts", "Share"]);
    expect(prisoner.rows).toHaveLength(5);
  });
});
