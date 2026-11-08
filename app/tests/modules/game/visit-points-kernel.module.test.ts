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
      voids: 0,
      busts: 0,
      scoringVisits: 0,
    });
  });

  it("the initial seat cannot be mutated through an empty fold", () => {
    expect(Object.isFrozen(foldVisitPoints([], RULES))).toBe(true);
  });

  it("a three-dart turn closes and scores its dart sum", () => {
    expect(foldVisitPoints([dartsTurn([60, 20, 5])], RULES)).toEqual({
      visits: 1,
      points: 85,
      lastVisitTotal: 85,
      openTotal: 0,
      dartsInVisit: 0,
      dartsThrown: 3,
      voids: 0,
      busts: 0,
      scoringVisits: 1,
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
      voids: 0,
      busts: 0,
      scoringVisits: 1,
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

  describe("voids and goal", () => {
    const FIVES: VisitPointsRules = {
      dartsPerVisit: 3,
      points: (t) => (t % 5 === 0 ? t / 5 : 0),
      voids: (darts) => darts.some((dart) => dart.score === 0),
      goal: 51,
    };
    const visit = (scores: number[]) => dartsTurn(scores);
    const atPoints = (points: number) =>
      Array.from({ length: points }, () => visit([1, 2, 2]));

    it("a void visit books nothing but keeps its total", () => {
      expect(foldVisitPoints([visit([20, 25, 0])], FIVES)).toMatchObject({
        visits: 1,
        points: 0,
        lastVisitTotal: 45,
        voids: 1,
        busts: 0,
        scoringVisits: 0,
      });
    });

    it("the same total on the board scores its points", () => {
      expect(foldVisitPoints([visit([20, 20, 5])], FIVES)).toMatchObject({
        points: 9,
        voids: 0,
        scoringVisits: 1,
      });
    });

    it("a visit past the goal busts and the points stay", () => {
      const seat = foldVisitPoints(
        [...atPoints(50), visit([5, 10, 10])],
        FIVES,
      );
      expect(seat).toMatchObject({ points: 50, busts: 1, voids: 0 });
      expect(seat.scoringVisits).toBe(50);
    });

    it("a visit that reaches the goal exactly scores", () => {
      expect(
        foldVisitPoints([...atPoints(50), visit([1, 2, 2])], FIVES),
      ).toMatchObject({ points: 51, busts: 0, scoringVisits: 51 });
    });

    it("a non-divisible total is a plain zero, neither void nor bust", () => {
      expect(foldVisitPoints([visit([20, 20, 3])], FIVES)).toMatchObject({
        visits: 1,
        points: 0,
        voids: 0,
        busts: 0,
        scoringVisits: 0,
      });
    });

    it("an open visit moves no counter", () => {
      expect(foldVisitPoints([visit([0, 0])], FIVES)).toMatchObject({
        visits: 0,
        voids: 0,
        busts: 0,
        scoringVisits: 0,
        dartsInVisit: 2,
      });
    });

    it("a keypad visit is never void", () => {
      expect(foldVisitPoints([keypadTurn(0)], FIVES)).toMatchObject({
        voids: 0,
      });
    });

    it("without voids or goal the counters stay zero", () => {
      expect(
        foldVisitPoints([visit([0, 0, 0]), visit([60, 60, 60])], RULES),
      ).toMatchObject({ points: 180, voids: 0, busts: 0 });
    });
  });
});
