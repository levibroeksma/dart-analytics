import { describe, it, expect } from "vitest";
import {
  fivesLastVisit,
  fivesLastVisitLabel,
  fivesSeatResult,
} from "@lib/game/fives-seats";
import type { DartFact, TurnFact } from "@modules/types";

function turn(ref: string, scores: number[], index = 0): TurnFact {
  return {
    clientKey: `${ref}-${index}`,
    participantRef: ref,
    darts: scores.map((score) => ({ score }) as DartFact),
    totalScore: 0,
    completedAt: null,
  } as unknown as TurnFact;
}

describe("fivesLastVisit", () => {
  it("is null before a seat's first closed visit", () => {
    expect(fivesLastVisit([], "p1")).toBeNull();
    expect(fivesLastVisit([turn("p1", [20, 20])], "p1")).toBeNull();
  });

  it("reads a scoring visit", () => {
    expect(fivesLastVisit([turn("p1", [20, 20, 5])], "p1")).toEqual({
      total: 45,
      points: 9,
      kind: "SCORE",
    });
  });

  it("reads a non-divisible total as ZERO", () => {
    expect(fivesLastVisit([turn("p1", [20, 20, 3])], "p1")?.kind).toBe("ZERO");
  });

  it("reads an off-board dart as VOID", () => {
    expect(fivesLastVisit([turn("p1", [20, 20, 0])], "p1")?.kind).toBe("VOID");
  });

  it("reads a visit past 51 as BUST and ignores another seat's turns", () => {
    const turns = [
      turn("p1", [60, 60, 60], 0),
      turn("p2", [1, 1, 1], 0),
      turn("p1", [60, 60, 60], 1),
      turn("p1", [60, 60, 60], 2),
      turn("p1", [60, 60, 60], 3),
    ];
    expect(fivesLastVisit(turns, "p1")).toEqual({
      total: 180,
      points: 0,
      kind: "BUST",
    });
    expect(fivesLastVisit(turns, "p2")?.kind).toBe("ZERO");
  });
});

describe("fivesLastVisitLabel", () => {
  it.each([
    [null, "—"],
    [{ total: 45, points: 9, kind: "SCORE" as const }, "+9"],
    [{ total: 7, points: 0, kind: "ZERO" as const }, "0"],
    [{ total: 45, points: 0, kind: "VOID" as const }, "Void"],
    [{ total: 180, points: 0, kind: "BUST" as const }, "Bust"],
  ])("labels %j as %s", (visit, label) => {
    expect(fivesLastVisitLabel(visit)).toBe(label);
  });
});

describe("fivesSeatResult", () => {
  it("projects a folded seat", () => {
    expect(
      fivesSeatResult({
        participantRef: "p1",
        sideKey: "A",
        total: 51,
        visits: 7,
        scoringVisits: 5,
        voids: 1,
        busts: 1,
        openTotal: 0,
        dartsInVisit: 0,
      }),
    ).toEqual({
      participantRef: "p1",
      sideKey: "A",
      total: 51,
      visits: 7,
      scoringVisits: 5,
      voids: 1,
      busts: 1,
    });
  });
});
