import { describe, it, expect } from "vitest";
import {
  applyVisitPointsTurn,
  foldVisitPoints,
} from "@modules/game/visit-points-kernel.module";
import type { VisitPointsRules } from "@modules/interfaces";
import type { TurnFact } from "@modules/types";

const dartsTurn = (scores: number[]): TurnFact =>
  ({
    completedAt: scores.length === 3 ? "t" : null,
    totalScore: scores.reduce((a, b) => a + b, 0),
    darts: scores.map((score) => ({ score })),
  }) as unknown as TurnFact;
const keypadTurn = (total: number): TurnFact =>
  ({ completedAt: "t", totalScore: total, darts: [] }) as unknown as TurnFact;

const RULES: VisitPointsRules = { dartsPerVisit: 3, points: (t) => t };
const BEATS: VisitPointsRules = {
  dartsPerVisit: 3,
  points: (t) => (t >= 65 ? 1 : 0),
};

describe("visit points kernel", () => {
  it("empty log is the initial seat", () => {
    expect(foldVisitPoints([], RULES)).toEqual({
      visits: 0,
      points: 0,
      lastVisitTotal: null,
      openTotal: 0,
      dartsInVisit: 0,
      dartsThrown: 0,
    });
  });

  it("a three-dart turn closes and scores its dart sum", () => {
    expect(foldVisitPoints([dartsTurn([60, 20, 5])], RULES)).toEqual({
      visits: 1,
      points: 85,
      lastVisitTotal: 85,
      openTotal: 0,
      dartsInVisit: 0,
      dartsThrown: 3,
    });
  });

  it("a short turn stays open and scores nothing yet", () => {
    expect(
      foldVisitPoints([dartsTurn([60, 20, 5]), dartsTurn([57, 3])], RULES),
    ).toEqual({
      visits: 1,
      points: 85,
      lastVisitTotal: 85,
      openTotal: 60,
      dartsInVisit: 2,
      dartsThrown: 5,
    });
  });

  it("a dartless turn closes on its stored totalScore", () => {
    expect(foldVisitPoints([keypadTurn(100)], RULES)).toMatchObject({
      visits: 1,
      points: 100,
      lastVisitTotal: 100,
      dartsThrown: 0,
    });
  });

  it("points come from the rules", () => {
    expect(
      foldVisitPoints(
        [dartsTurn([20, 20, 25]), dartsTurn([20, 20, 24])],
        BEATS,
      ),
    ).toMatchObject({ visits: 2, points: 1, lastVisitTotal: 64 });
  });

  it("open turn after close is reopened", () => {
    const seat = foldVisitPoints([dartsTurn([60, 20, 5])], RULES);
    expect(applyVisitPointsTurn(seat, dartsTurn([60, 1]), RULES)).toMatchObject(
      { visits: 1, openTotal: 61, dartsInVisit: 2 },
    );
  });
});
